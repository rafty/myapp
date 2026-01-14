/**
 * @purpose   VPC Endpoints（Gateway/Interface）の骨格を提供
 * @stack     network-stack
 * @overview  初期は必須エンドポイントの雛形のみ。詳細は Phase 4 で実装。
 */
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface VpcEndpointsProps {
  readonly project: string;
  readonly stage: string;
  readonly vpc: ec2.IVpc;
  /** 任意エンドポイント群の有効化（stage により切替）。未指定時は sbx=false, それ以外=true */
  readonly enableOptionalEndpoints?: boolean;
  /** Interface VPCE 用の専用 SG（なければデフォルトで作成） */
  readonly endpointSecurityGroup?: ec2.SecurityGroup;
}

export class VpcEndpoints extends Construct {
  constructor(scope: Construct, id: string, props: VpcEndpointsProps) {
    super(scope, id);

    const { vpc, stage } = props;

    // VPC Endpoint 用の最小権限 SG（インバウンド無し、アウトバウンドはデフォルト）
    const endpointSg =
      props.endpointSecurityGroup ??
      new ec2.SecurityGroup(this, 'EndpointsSG', {
        vpc,
        allowAllOutbound: false,
        description: 'VPC Interface Endpoints SG (least privilege)',
      });
    if (!props.endpointSecurityGroup) {
      // 443 のみ外向き許可
      endpointSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'VPCE to AWS services 443');
    }

    // 必須エンドポイント
    const s3Gateway = vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
    // Gateway VPCE のポリシーは作成後に addToPolicy で追加
    s3Gateway.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        resources: [
          'arn:aws:s3:::myapp-artifacts-222222222222-ap-northeast-1',
          'arn:aws:s3:::myapp-artifacts-222222222222-ap-northeast-1/*',
        ],
        principals: [new iam.AnyPrincipal()],
        conditions: { StringEquals: { 'aws:PrincipalAccount': '222222222222' } },
      }),
    );

    const addIf = (id: string, service: ec2.InterfaceVpcEndpointAwsService) => {
      vpc.addInterfaceEndpoint(id, {
        service,
        securityGroups: [endpointSg],
      });
    };

    addIf('EcrApiEndpoint', ec2.InterfaceVpcEndpointAwsService.ECR);
    addIf('EcrDkrEndpoint', ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER);
    addIf('CloudWatchLogsEndpoint', ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS);
    addIf('StsEndpoint', ec2.InterfaceVpcEndpointAwsService.STS);
    addIf('Ec2Endpoint', ec2.InterfaceVpcEndpointAwsService.EC2);
    addIf('Ec2MessagesEndpoint', ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES);
    addIf('EcsEndpoint', ec2.InterfaceVpcEndpointAwsService.ECS);
    addIf('EcsAgentEndpoint', ec2.InterfaceVpcEndpointAwsService.ECS_AGENT);
    addIf('EcsTelemetryEndpoint', ec2.InterfaceVpcEndpointAwsService.ECS_TELEMETRY);

    // 任意（必要時導入、フラグ制御）: sbx ではデフォルト無効、他ステージ有効
    const enableOptional = props.enableOptionalEndpoints ?? (stage !== 'sbx');
    if (enableOptional) {
      vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        securityGroups: [endpointSg],
      });
      vpc.addInterfaceEndpoint('SsmEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
        securityGroups: [endpointSg],
      });
      vpc.addInterfaceEndpoint('SsmMessagesEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
        securityGroups: [endpointSg],
      });
      vpc.addInterfaceEndpoint('KmsEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.KMS,
        securityGroups: [endpointSg],
      });
      vpc.addGatewayEndpoint('DynamoDbEndpoint', {
        service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      });
    }
  }
}
