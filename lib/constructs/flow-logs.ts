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

export interface FlowLogsProps {
  readonly project: string;
  readonly stage: string;
  readonly vpc: ec2.IVpc;
}

export class FlowLogs extends Construct {
  constructor(scope: Construct, id: string, props: FlowLogsProps) {
    super(scope, id);

    const { vpc, project } = props;

    // KMS CMK（既存のエイリアスを参照）
    const key = kms.Alias.fromAliasName(this, 'LogsKmsAlias', 'alias/myapp-logs');

    // CloudWatch Log Group（365 日保持 + KMS 暗号化）
    const logGroup = new logs.LogGroup(this, 'VpcFlowLogsGroup', {
      logGroupName: `${project}-network-logs`,
      retention: logs.RetentionDays.ONE_YEAR,
      encryptionKey: key,
    });

    // VPC Flow Logs（全トラフィック） - L1 で明示的に作成し、cdk-nag の検出を満たす
    const flowLogsRole = new iam.Role(this, 'VpcFlowLogsRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
      description: 'IAM role for VPC Flow Logs to publish to CloudWatch Logs',
    });
    flowLogsRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogStreams',
        'logs:DescribeLogGroups',
      ],
      resources: [logGroup.logGroupArn, `${logGroup.logGroupArn}:*`],
    }));

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
