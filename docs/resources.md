# Resources

本ドキュメントは `myapp` の Network Stack における主要リソースの一覧です。生成元: CDK 構成（概要）。

- Stack 名: `myapp-<stage>-an1-network`
- 構成要素:
  - VPC: `MyappVpc` (10.100.0.0/16)
  - Subnets (2AZ x 3-tier + Egress Public): `Egress`, `Frontend`, `Application`, `Datastore`
  - NAT Gateway: 2 (各 AZ)
  - Internet Gateway: 1
  - VPC Endpoints:
    - Gateway: S3
    - Interface: ECR, ECR_DOCKER, CLOUDWATCH_LOGS, STS, EC2, EC2_MESSAGES, ECS, ECS_AGENT, ECS_TELEMETRY
    - Optional (stage トグル): SECRETS_MANAGER, SSM, SSM_MESSAGES, KMS, DYNAMODB(Gateway)
  - Security Groups:
    - Internal ALB SG（オンプレ CIDR は TBD）
    - Application SG（ALB → App: 80/443 許可）
    - Datastore SG（App → Datastore: 6379 許可）
  - Flow Logs: CloudWatch Logs（保持 365 日）
  - Tags: `Project=myapp`, `Environment=<stage>`, `Owner=JP-Solution`, `CostCenter=SOL-12345678`

注: Logical ID や詳細プロパティは `cdk.out/<stack>.template.json` を参照。
