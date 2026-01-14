Network details (Mermaid diagrams)

通信・経路の概要（簡易）。

```mermaid
flowchart TB
  subgraph VPC[myapp VPC 10.100.0.0/16]
    subgraph AZa
      Ega[Egress Public Subnet /28]
      Fea[Frontend Subnet /24]
      Apa[Application Subnet /24]
      Dsa[Datastore Subnet /24]
    end
    subgraph AZc
      Egc[Egress Public Subnet /28]
      Fec[Frontend Subnet /24]
      Apc[Application Subnet /24]
      Dsc[Datastore Subnet /24]
    end
  end

  IGW[Internet Gateway]
  NATa[NAT GW AZa]
  NATc[NAT GW AZc]

  IGW --- Ega
  IGW --- Egc
  Fea --> NATa --> IGW
  Fec --> NATc --> IGW
  Apa --> NATa --> IGW
  Apc --> NATc --> IGW
  Apa -->|6379| Dsa
  Apc -->|6379| Dsc

  classDef tier fill:#eef,stroke:#88f;
  class Fea,Fec tier;
  class Apa,Apc tier;
  class Dsa,Dsc tier;
```

セキュリティ
- SG: ALB→App 80/443、App→Datastore 6379
- NACL: 各レイヤで最小権限の雛形（将来厳格化）

VPC Endpoints（例）
- Gateway: S3（全ステージ）
- Interface: ECR/ECR_DKR/Logs/STS/EC2/EC2Messages/ECS/ECS-Agent/ECS-Telemetry（全ステージ）
- Optional: Secrets Manager/SSM/SSM Messages/KMS、Gateway: DynamoDB（stage 切替）
