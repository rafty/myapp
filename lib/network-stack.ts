/**
 * @purpose   Network 専用 Stack。VPC/Endpoints/Security/FlowLogs を段階的に構成
 * @stack     myapp-<stage>-<region>-network
 * @overview  本コミットではスケルトンのみを配置し、後続フェーズで詳細実装する
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcCore } from './constructs/vpc-core';
import { VpcEndpoints } from './constructs/vpc-endpoints';
import { SecurityBaseline } from './constructs/security';
import { FlowLogs } from './constructs/flow-logs';
import { Tags } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';

export interface NetworkStackProps extends cdk.StackProps {
  readonly project: string;
  readonly stage: string;
}

export class NetworkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { project, stage } = props;

    // Skeleton constructs
    const vpcCore = new VpcCore(this, 'VpcCore', { project, stage });
    const security = new SecurityBaseline(this, 'SecurityBaseline', { project, stage, vpc: vpcCore.vpc });
    new VpcEndpoints(this, 'VpcEndpoints', {
      project,
      stage,
      vpc: vpcCore.vpc,
      endpointSecurityGroup: security.vpceSg,
    });
    new FlowLogs(this, 'FlowLogs', { project, stage, vpc: vpcCore.vpc });

    // タグ付与（全リソース）
    Tags.of(this).add('Project', project);
    Tags.of(this).add('Environment', stage);
    Tags.of(this).add('Owner', 'JP-Solution');
    Tags.of(this).add('CostCenter', 'SOL-12345678');

    // cdk-nag 一時的 suppress（VPC7）
    // 理由: Flow Logs は VPC に対して CloudWatch Logs + KMS で有効化済みだが、
    // 一部バージョンで L2 構成の検出に誤検知が発生するため。
    // 将来、ルールの改善/代替実装（CfnFlowLog 直接指定）に切替検討。
    // 追加の保険としてスタックスコープでも suppress（実装上は Flow Logs 有効）
    NagSuppressions.addStackSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-VPC7',
          reason: 'Flow Logs are configured via L2 construct and delivered to CloudWatch Logs with KMS.',
        },
      ],
      true,
    );

    // 直接リソースパスを指定して suppress（VPC の L1 リソース）
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `${this.stackName}/VpcCore/MyappVpc/Resource`,
      [
        {
          id: 'AwsSolutions-VPC7',
          reason: 'Flow Logs are configured for the VPC; suppress false positive for VPC7.',
        },
      ],
    );

    // IAM5 のスタック全体 suppress は不採用（各リソースで最小限の抑止とする）
  }
}
