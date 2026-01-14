/**
 * @purpose   基本的な Security Group と Network ACL の骨格を提供
 * @stack     network-stack
 * @overview  具体的な許可ルールは Phase 3 で詳細化する
 */
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface SecurityBaselineProps {
  readonly project: string;
  readonly stage: string;
  readonly vpc: ec2.IVpc;
}

export class SecurityBaseline extends Construct {
  readonly albSg: ec2.SecurityGroup;
  readonly appSg: ec2.SecurityGroup;
  readonly datastoreSg: ec2.SecurityGroup;
  readonly vpceSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityBaselineProps) {
    super(scope, id);

    const { vpc } = props;

    // SG: Internal ALB
    this.albSg = new ec2.SecurityGroup(this, 'AlbSG', {
      vpc,
      allowAllOutbound: true,
      description: 'Internal ALB SG',
    });
    // オンプレ/社内からの 443 のみ許可
    this.albSg.addIngressRule(ec2.Peer.ipv4('203.0.113.0/24'), ec2.Port.tcp(443), 'Onprem to ALB 443');
    this.albSg.addIngressRule(ec2.Peer.ipv4('10.16.0.0/12'), ec2.Port.tcp(443), 'Corp to ALB 443');

    // SG: Application
    this.appSg = new ec2.SecurityGroup(this, 'AppSG', {
      vpc,
      allowAllOutbound: false,
      description: 'Application tier SG',
    });
    // ALB → App: 80 のみ
    this.appSg.addIngressRule(this.albSg, ec2.Port.tcp(80), 'ALB to App 80');

    // SG: VPCE（Interface Endpoints 用）
    this.vpceSg = new ec2.SecurityGroup(this, 'VpceSG', {
      vpc,
      allowAllOutbound: false,
      description: 'VPC Interface Endpoints SG (no ingress, 443 egress only)'
    });
    // VpceSG: Ingress 無し / Egress 443 のみ
    this.vpceSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'VPCE to AWS services 443');

    // AppSG egress: VPCE SG のみ 443 を許可
    this.appSg.addEgressRule(this.vpceSg, ec2.Port.tcp(443), 'App to VPCE 443');

    // SG: Datastore（例：Redis 6379）
    this.datastoreSg = new ec2.SecurityGroup(this, 'DatastoreSG', {
      vpc,
      allowAllOutbound: true,
      description: 'Datastore tier SG',
    });
    // Application → Datastore: TCP 6379 を最小範囲で許可（SG 参照）
    this.datastoreSg.addIngressRule(this.appSg, ec2.Port.tcp(6379), 'App to Datastore 6379');

    // NACL（雛形）: 各 tier ごとに最小権限の方向/ポートを定義（厳格化は将来）
    // Frontend
    const feSubnets = props.vpc.selectSubnets({ subnetGroupName: 'Frontend' }).subnets;
    const feNacl = new ec2.NetworkAcl(this, 'FrontendNacl', { vpc: props.vpc });
    // inbound: 社内からのエフェメラル（必要に応じて段階縮小）
    feNacl.addEntry('FrontendInboundEphemeral', {
      ruleNumber: 100,
      cidr: ec2.AclCidr.ipv4('10.16.0.0/12'),
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });
    // outbound: インターフェイス/エンドポイント/NAT 経由の外向き
    feNacl.addEntry('FrontendOutboundEphemeral', {
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    });
    feSubnets.forEach((s, i) => new ec2.CfnSubnetNetworkAclAssociation(this, `FeNaclAssoc${i + 1}`, { networkAclId: feNacl.networkAclId, subnetId: s.subnetId }));

    // Application
    const appSubnets = props.vpc.selectSubnets({ subnetGroupName: 'Application' }).subnets;
    const appNacl = new ec2.NetworkAcl(this, 'ApplicationNacl', { vpc: props.vpc });
    appNacl.addEntry('AppInboundFromAlb', {
      ruleNumber: 100,
      cidr: ec2.AclCidr.ipv4('10.100.0.0/16'),
      traffic: ec2.AclTraffic.tcpPort(80),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });
    appNacl.addEntry('AppInboundFromAlbTls', {
      ruleNumber: 110,
      cidr: ec2.AclCidr.ipv4('10.100.0.0/16'),
      traffic: ec2.AclTraffic.tcpPort(443),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });
    appNacl.addEntry('AppOutboundEphemeral', {
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    });
    appSubnets.forEach((s, i) => new ec2.CfnSubnetNetworkAclAssociation(this, `AppNaclAssoc${i + 1}`, { networkAclId: appNacl.networkAclId, subnetId: s.subnetId }));

    // Datastore
    const dsSubnets = props.vpc.selectSubnets({ subnetGroupName: 'Datastore' }).subnets;
    const dsNacl = new ec2.NetworkAcl(this, 'DatastoreNacl', { vpc: props.vpc });
    dsNacl.addEntry('DsInboundFromAppRedis', {
      ruleNumber: 100,
      cidr: ec2.AclCidr.ipv4('10.100.0.0/16'),
      traffic: ec2.AclTraffic.tcpPort(6379),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });
    dsNacl.addEntry('DsOutboundEphemeral', {
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    });
    dsSubnets.forEach((s, i) => new ec2.CfnSubnetNetworkAclAssociation(this, `DsNaclAssoc${i + 1}`, { networkAclId: dsNacl.networkAclId, subnetId: s.subnetId }));
  }
}
