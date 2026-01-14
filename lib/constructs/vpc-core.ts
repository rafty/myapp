/**
 * @purpose   VPC/Subnet/RouteTable/IGW/Regional NAT の骨格を提供する再利用可能 Construct
 * @stack     network-stack（単一責任: Network）
 * @overview  本フェーズでは骨格のみ。詳細なルーティング/NAT は後続フェーズで実装。
 */
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface VpcCoreProps {
  readonly project: string;
  readonly stage: string;
}

export class VpcCore extends Construct {
  // 参照用ハンドル
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcCoreProps) {
    super(scope, id);

    // Phase 2: VPC / Subnets / IGW / NAT（CDK の L2 で自動作成）
    // - CIDR は暫定（将来 ADR で可変化）
    // - Frontend, Application: PRIVATE_WITH_EGRESS（0.0.0.0/0 → NAT）
    // - Datastore: PRIVATE_ISOLATED（デフォルトルートなし）
    // - maxAzs=2、natGateways=2（Regional での冗長性）
    this.vpc = new ec2.Vpc(this, 'MyappVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.100.0.0/16'),
      maxAzs: 2,
      natGateways: 2,
      subnetConfiguration: [
        {
          // NAT Gateway を配置するための最小 Public サブネット（業務ワークロードは配置しない）
          name: 'Egress',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 28,
        },
        {
          name: 'Frontend',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Application',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Datastore',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });
  }
}
