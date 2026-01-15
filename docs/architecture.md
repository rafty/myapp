アーキテクチャ概要

概要
- 3 つのサブネットグループを持つ VPC（Frontend / Application / Datastore）
- Security Group と NACL により最小権限のベースラインを提供
- VPC Flow Logs は、スタック管理の KMS Key で暗号化された CloudWatch Logs へ配信
- Flow Logs 用 IAM Role は特定の LogGroup / LogStreams にスコープ

Mermaid 図（全体構成）

```mermaid
flowchart LR
  %% 外部
  OnPrem["企業/オンプレミス"]
  AWS["AWS Account <account>"]

  %% VPC / Subnets
  subgraph VPC["VPC 10.100.0.0/16"]
    direction TB
    subgraph FE["Frontend Subnets (Public)"]
      ALB["ALB (ALB SG)"]
    end
    subgraph APP["Application Subnets (Private)"]
      APPWkld["App ワークロード (ECS/Lambda/EC2) (App SG)"]
    end
    subgraph DATA["Datastore Subnets (Private)"]
      Redis["Datastore (例: Redis/DB) (Datastore SG)"]
    end
    subgraph VPCE["VPC Endpoints (Interface)"]
      VPCE_CWL["VPCE: CloudWatch Logs"]
      VPCE_SSM["VPCE: SSM"]
    end
    NAT["NAT Gateway"]
    IGW["Internet Gateway"]
  end

  %% CloudWatch Logs / KMS
  CWL[("CloudWatch Logs: myapp-network-logs")]
  KMS[("KMS CMK (ローテーション有効)")]

  %% 結線（通信フローの例）
  OnPrem ---|443| ALB
  ALB -->|80| APPWkld
  APPWkld -->|6379| Redis
  FE --> IGW
  APP --> NAT --> IGW
  APPWkld -->|443| VPCE_CWL
  VPCE_CWL --> CWL -. 暗号化 .-> KMS

  %% 装飾
  classDef sg stroke:#1f78b4,stroke-width:2px;
  class ALB,APPWkld,Redis sg;
```

主要ポリシー
- KMS Key Policy は最小権限：特定の LogGroup に結びつけた Encryption Context、`GrantIsForAWSResource` による `CreateGrant` / `DescribeKey` の制限、アカウント root への `ViaService` 条件
