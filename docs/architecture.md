Architecture overview

現時点のスコープで作成済みの論理構成を記載します（簡易）。
- VPC 10.100.0.0/16（2AZ）
- Subnets: Egress(Public), Frontend(/24 x2), Application(/24 x2), Datastore(/24 x2)
- NAT Gateway: 2（各AZ）/ IGW: 1
- VPC Endpoints: 必須一式 + ステージにより任意エンドポイント
- Security Groups: ALB, Application, Datastore（最小権限）
- Flow Logs: CloudWatch Logs（保持 365 日）

メモ:
- ALB/ECS は本フェーズでは方針のみ（リソース未作成）
- Endpoints は段階導入（stage 切替）
