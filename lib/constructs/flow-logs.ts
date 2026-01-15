/**
 * @purpose   VPC Flow Logs と CloudWatch Logs の骨格を提供
 * @stack     network-stack
 * @overview  Flow Logs の具体実装は Phase 5 で行う
 */
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';

export interface FlowLogsProps {
  readonly project: string;
  readonly stage: string;
  readonly vpc: ec2.IVpc;
}

export class FlowLogs extends Construct {
  constructor(scope: Construct, id: string, props: FlowLogsProps) {
    super(scope, id);

    const { vpc, project } = props;

    // KMS CMK（本スタックで管理）。
    // 既存 Alias 参照（Alias.fromAliasName）は synth 時に aliasTargetKey へアクセスできず
    // ValidationError となるため、ここでは専用の Key を作成して使用する。
    const key = new kms.Key(this, 'LogsKmsKey', {
      enableKeyRotation: true,
      description: 'KMS key for CloudWatch Logs encryption of VPC Flow Logs',
    });

    // CloudWatch Log Group（365 日保持 + KMS 暗号化）
    const logGroupName = `${project}-${props.stage}-network-logs`;
    const logGroup = new logs.LogGroup(this, 'VpcFlowLogsGroup', {
      logGroupName,
      retention: logs.RetentionDays.ONE_YEAR,
      encryptionKey: key,
    });

    // CloudWatch Logs サービスが当該 KMS Key を使用できるように Key Policy を付与
    // 最小権限: 対象 LogGroup の Encryption Context に限定
    const stack = cdk.Stack.of(this);
    const logsArnForCondition = cdk.Arn.format(
      {
        service: 'logs',
        resource: 'log-group',
        resourceName: logGroupName,
        region: stack.region,
        account: stack.account,
        partition: stack.partition,
      },
      stack,
    );
    // 1) 暗号化/復号などデータキー操作は LogGroup の Encryption Context に限定（ワイルドカードでログストリームも包含）
    key.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCWLUseKeyForThisLogGroupOnly',
      principals: [new iam.ServicePrincipal(`logs.${stack.region}.amazonaws.com`)],
      actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*'],
      resources: ['*'],
      conditions: {
        ArnLike: { 'kms:EncryptionContext:aws:logs:arn': [logsArnForCondition, `${logsArnForCondition}:*`] },
      },
    }));

    // 2) CreateGrant/DescribeKey は AWS リソースのための付与のみ許可（EncryptionContext 条件は不要）
    key.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCWLGrantAndDescribe',
      principals: [new iam.ServicePrincipal(`logs.${stack.region}.amazonaws.com`)],
      actions: ['kms:CreateGrant', 'kms:DescribeKey'],
      resources: ['*'],
      conditions: {
        Bool: { 'kms:GrantIsForAWSResource': true },
      },
    }));

    // 3) アカウントルート経由の ViaService 許可（CloudWatch Logs サービス経由の利用を明示）
    key.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowAccountViaServiceForCWL',
      principals: [new iam.AccountRootPrincipal()],
      actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'kms:ViaService': `logs.${stack.region}.amazonaws.com`,
          'kms:CallerAccount': stack.account,
        },
      },
    }));

    // 一時的な広めの許可は削除（最小権限化）。
    // CloudWatch Logs には上記 1) 2) 3) のポリシーで必要最小権限のみを付与する。

    // VPC Flow Logs（全トラフィック） - L1 で明示的に作成し、cdk-nag の検出を満たす
    const flowLogsRole = new iam.Role(this, 'VpcFlowLogsRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
      description: 'IAM role for VPC Flow Logs to publish to CloudWatch Logs',
    });
    // CloudWatch Logs の ARN はコロン区切り（log-group:...:log-stream:...）を使用する
    const logGroupArnColon = cdk.Arn.format(
      {
        service: 'logs',
        resource: 'log-group',
        resourceName: logGroupName,
        arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
        region: stack.region,
        account: stack.account,
        partition: stack.partition,
      },
      stack,
    );
    const logStreamArnWildcard = `${logGroupArnColon}:log-stream:*`;
    // Inline Policy（明示作成）で最小権限を付与
    const flowLogsPolicy = new iam.Policy(this, 'VpcFlowLogsPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['logs:CreateLogStream', 'logs:DescribeLogStreams'],
          resources: [logGroupArnColon],
        }),
        new iam.PolicyStatement({
          actions: ['logs:PutLogEvents'],
          resources: [logStreamArnWildcard],
        }),
      ],
    });
    flowLogsPolicy.attachToRole(flowLogsRole);

    // cdk-nag: IAM5 の精密抑止（Policy リソースに付与）
    NagSuppressions.addResourceSuppressions(flowLogsPolicy, [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'CloudWatch Logs の PutLogEvents は動的な LogStream に対する書き込みであり、対象 LogGroup 配下の log-stream:* への限定的ワイルドカードが必須。',
        appliesTo: [
          'Action::logs:PutLogEvents',
          `Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group/${logGroupName}:log-stream:*`,
        ],
      },
    ], true);

    // DefaultPolicy へのパス抑止は不要（明示 Policy に対してのみ精密抑止を付与）

    new ec2.CfnFlowLog(this, 'VpcAllFlowLogs', {
      resourceId: vpc.vpcId,
      resourceType: 'VPC',
      trafficType: 'ALL',
      logDestinationType: 'cloud-watch-logs',
      logGroupName: logGroup.logGroupName,
      deliverLogsPermissionArn: flowLogsRole.roleArn,
    });
  }
}
