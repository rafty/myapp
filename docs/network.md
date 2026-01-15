ネットワーク概要

VPC
- CIDR: 10.100.0.0/16
- サブネットグループ: Frontend / Application / Datastore（2 AZ 以上）

Internet / NAT
- Internet Gateway をアタッチ
- NAT Gateway を配置（1 つ以上）

Security Group
- ALB SG: 企業/オンプレミスのレンジからの 443 を許可
- App SG: ALB からの 80 のみ受信; 送信は VPCE SG:443 のみ
- VPCE SG: 受信なし; 送信は 443 のみ
- Datastore SG: App SG からの 6379 を許可

NACL（スケルトン）
- Frontend: 企業レンジのエフェメラルポートの入出力を許可
- Application: VPC 内からの 80/443 を受信許可; 送信はエフェメラル
- Datastore: VPC 内からの 6379 を受信許可; 送信はエフェメラル

Flow Logs
- 送信先: CloudWatch Logs の LogGroup `myapp-network-logs`
- 保持期間: 365 日
- 暗号化: KMS CMK（ローテーション有効）
- IAM Role: LogGroup / LogStreams に対して最小権限

Mermaid 図（ネットワーク構成）

```mermaid
flowchart TB
  %% IGW / NAT
  IGW["Internet Gateway"]
  NAT["NAT Gateway"]

  %% VPC とサブネット
  subgraph VPC["VPC 10.100.0.0/16"]
    direction TB
    subgraph FE["Frontend Subnets (Public)"]
      ALB["ALB (ALB SG)"]
    end
    subgraph APP["Application Subnets (Private)"]
      APPWkld["App ワークロード (App SG)"]
      VPCE_CWL["VPCE: CloudWatch Logs (VPCE SG)"]
    end
    subgraph DATA["Datastore Subnets (Private)"]
      Redis["Datastore (例: Redis) (Datastore SG)"]
    end
  end

  %% CloudWatch Logs / KMS
  CWL[("CloudWatch Logs: myapp-network-logs")]
  KMS[("KMS CMK (ローテーション有効)")]

  %% 経路
  ALB --- IGW
  APPWkld --> NAT --> IGW

  %% 通信フロー（ポート注記）
  ALB -->|80| APPWkld
  APPWkld -->|6379| Redis
  APPWkld -->|443| VPCE_CWL --> CWL -. 暗号化 .-> KMS

  %% 参考: NACL（概念）
  classDef nacl fill:#f9f9f9,stroke:#999,stroke-dasharray: 3 3;
  FE:::nacl
  APP:::nacl
  DATA:::nacl

  %% 参考: SG（強調）
  classDef sg stroke:#1f78b4,stroke-width:2px;
  class ALB,APPWkld,Redis,VPCE_CWL sg;
```
