# リソースサマリ

このドキュメントは `NetworkStack` により作成される主要リソースを、セキュリティ制御に焦点を当てて一覧化します。

## Stacks / Constructs
- Stack: `myapp-<stage>-an1-network`
  - Constructs:
    - `VpcCore`: VPC、サブネット（Frontend / Application / Datastore）、NAT GW、IGW
    - `SecurityBaseline`: Security Group（ALB / App / Datastore / VPCE）、NACL（Frontend / Application / Datastore）
    - `VpcEndpoints`: Interface / Gateway Endpoints（スケルトン）
    - `FlowLogs`: CloudWatch Logs + KMS 暗号化、VPC Flow Logs（ALL）

## CloudWatch Logs
- LogGroup: `myapp-network-logs`
  - 保持期間: 1 年
  - KMS: Customer Managed Key（本スタックで管理）

## KMS Key（CloudWatch Logs 暗号化）
- キーローテーション: 有効
- Key Policy（最小権限）:
  - CloudWatch Logs のサービスプリンシパル `logs.<region>.amazonaws.com` に対して、`myapp-network-logs`（およびそのストリーム）の Encryption Context に限定した Encrypt / Decrypt / ReEncrypt* / GenerateDataKey* を許可
  - `kms:GrantIsForAWSResource=true` を条件とした `kms:CreateGrant` / `kms:DescribeKey` を許可
  - アカウント root については `kms:ViaService = logs.<region>.amazonaws.com` かつ `kms:CallerAccount = <account>` の条件で許可

## VPC Flow Logs 用 IAM
- Role: `VpcFlowLogsRole`
  - 信頼ポリシー（Trust）：`vpc-flow-logs.amazonaws.com`
  - インラインポリシー（明示的）:
    - LogGroup の ARN に対してのみ `logs:CreateLogStream`、`logs:DescribeLogStreams` を許可
    - 動的に作成される LogStream の仕様上必要なワイルドカードのため、`log-group:...:log-stream:*` に対する `logs:PutLogEvents` を許可（CWL の仕様）
  - cdk-nag: `log-stream:*` に対する `PutLogEvents` のみ、理由を明記したうえでピンポイントに suppress を適用
