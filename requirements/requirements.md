# myapp ネットワーク要件

本書は `requirements/requirements-draft.md` のドラフトを精査し、AWS のプロフェッショナル視点で曖昧さを排除・補強した正式要件定義である。AWS CDK TypeScript プロジェクト（本リポジトリ）での実装を前提に、設計原則・命名・セキュリティ・運用基準を明確化する。

---

## 1. 目的・スコープ

- 目的: myapp のワークロード（ECS on Fargate 予定）が安全かつ拡張性の高いネットワーク上で稼働できるよう、VPC および周辺ネットワークコンポーネントの要件を定義する。
- スコープ: VPC、Subnet、Route、Regional NAT、Network ACL、Security Group、VPC Endpoint、Flow Logs、基本的なタグ・命名・環境構成。将来利用予定の Direct Connect/Transit Gateway（以下 TGW）との接続前提を満たす設計とするが、本要件では TGW リソース自体は作成しない。

---

## 2. 環境・アカウント・リージョン

- ステージ（stage）: `sbx`, `dev`, `stg`, `prod`
- アカウント（暫定）:
  - `sbx`: `338456725408`
  - `dev`: `111111111111`
  - `stg`: `222222222222`
  - `prod`: `333333333333`
- リージョン: すべて `ap-northeast-1`
- CDK の設計原則: 環境値は `env-config.ts` 相当の一元管理とし、スタック内へのハードコードは禁止。
- デプロイ: Sandbox は CLI、`dev/stg/prod` は CI/CD で安全に注入。

---

## 3. 命名・タグ付け

- プロジェクト名: `myapp`
- スタック名規則: `<project>-<stage>-<region>-<component>` 例: `myapp-sbx-an1-network`
- リソース名規則: `<Project><Component><Purpose>` 例: `MyappVpc`、`MyappApplicationSubnetA`
- 必須タグ:
  - `Project`: `myapp`
  - `Environment`: `sbx|dev|stg|prod`
  - `Owner`: `JP-Solution`
  - `CostCenter`: `SOL-12345678`

---

## 4. ネットワークアーキテクチャ

### 4.1 構成ポリシー

- マルチ AZ: 2 AZ 構成（例: `ap-northeast-1a`, `ap-northeast-1c`）。
- Three-tier Architecture の採用: `frontend` / `application` / `datastore` の3層を各 AZ に作成。Internal 構成（オンプレミスからのアクセスを受け付ける）とし、Internet-facing ではない。
- インターネットからの受信（ingress）は不要。オンプレミス（DX/TGW）からのアクセスを前提。
- アウトバウンドは Regional NAT 経由でインターネットへ接続（ソフトウェア更新や外部 API 利用想定）。
- IGW（Internet Gateway）は VPC に 1 つ作成してアタッチし、Regional NAT を 1 つ使用（サービスとしてリージョン冗長・高可用）し、デフォルトルートを IGW に向ける設計とする。
 - 役割分担: Frontend Subnet は Internal ALB（Application Load Balancer）を配置する専用サブネット。ECS タスクは Application Subnet に配置する。

### 4.2 CIDR 設計

- VPC CIDR（暫定提案・変更可）: `10.100.0.0/16`
- サブネット分割（各 AZ あたり）例:（Three-tier の 3 層のみ）
  - Frontend Subnet: `/24`
  - Application Subnet: `/24`
  - Datastore Subnet: `/24`
- 合計サブネット数（2 AZ）: 6 サブネット（Frontend x2, Application x2, Datastore x2）

注: 正式 CIDR は将来の TGW 接続・オンプレ CIDR（暫定 `10.0.0.0/8`）との重複回避を前提に決定する。重複回避を最優先とし、必要に応じて VPC CIDR を変更可能とする。

### 4.3 サブネット種別とルーティング

- Frontend Subnet（各 AZ）
  - 目的: Internal ALB を配置（オンプレミスからの通信を受け、Application Subnet 上のターゲットへフォワード）。対外公開はしない（Internet-facing ではない）。
  - ルート: `0.0.0.0/0` → Regional NAT（Regional NAT はゾーン非依存のため、各サブネットは Regional NAT をデフォルトターゲットとする）
- Application Subnet（各 AZ）
  - 目的: ECS タスク（application tier）を配置（Internal ALB のターゲット）
  - ルート: `0.0.0.0/0` → Regional NAT（ゾーン非依存）
- Datastore Subnet（各 AZ）
  - 目的: データストア（例: Redis 互換、ポート 6379）
  - ルート: 原則インターネットへは出さない。必要な場合のみ Regional NAT を経由（要リスク評価）。

将来の DX/TGW ルートは別途 Route Table に追加予定（本要件のスコープ外、ただし拡張余地を確保）。

### 4.4 インターネット関連

- IGW は VPC に 1 つ作成しアタッチする（Regional NAT のインターネット到達に必要）。
- Regional NAT を使用し、プライベートサブネットからのデフォルトルート（`0.0.0.0/0`）は Regional NAT を指す（Regional NAT は背後で IGW を経由して外部に到達）。
- ワークロード ENI には Public IP を割り当てない。
- 参考: IPv6 のアウトバウンドのみが必要な場合は Egress-Only IGW の適用を検討（本要件の詳細スコープ外）。

---

## 5. セキュリティ

### 5.1 Security Group（最小権限）

- 原則としてインバウンド/アウトバウンドは最小限。
- レイヤ間通信のみ許可:
  - オンプレ（DX/TGW 経由 CIDR/Attachment）→ Internal ALB: 80/443 など必要ポートのみ
  - Internal ALB → application: ターゲットポート（HTTP/HTTPS など、実装段階で決定）
  - `application → datastore`: TCP 6379（暫定）
  - オンプレ → `frontend`/`application`/`datastore`: DX/TGW ルート経由で必要最小限を個別開放
- セキュリティグループ間参照を活用し、CIDR ベースの広範許可を避ける。

### 5.2 Network ACL（最小権限）

- すべてのサブネットに NACL を設定。基本はステートレスで最小限の許可。
- 具体的な許可ルールは実装段階で決定（例: 各サブネットの東西/南北トラフィックに合わせた最小開放）。

### 5.3 IAM・暗号化

- IAM は最小権限。ワイルドカード（`*`）は原則禁止。やむを得ない場合は理由を明記し `cdk-nag` で検知されないよう適正化。
- KMS 暗号化（Logs/S3/EBS/RDS など）はサービス標準の暗号化を優先利用。

---

## 6. VPC Endpoint（PrivateLink）

ECS/Fargate ワークロードがインターネット経由に依存しないよう、以下の VPC Endpoint を原則作成（必要に応じて段階導入可）。

- Gateway 型
  - S3（必須）
  - DynamoDB（必要時）
- Interface 型（各 AZ にエンドポイント ENI を配置）
  - com.amazonaws.ap-northeast-1.ecr.api
  - com.amazonaws.ap-northeast-1.ecr.dkr
  - com.amazonaws.ap-northeast-1.logs
  - com.amazonaws.ap-northeast-1.ecs
  - com.amazonaws.ap-northeast-1.ecs-agent
  - com.amazonaws.ap-northeast-1.ecs-telemetry
  - com.amazonaws.ap-northeast-1.secretsmanager（必要時）
  - com.amazonaws.ap-northeast-1.ssm（必要時）
  - com.amazonaws.ap-northeast-1.ssmmessages（必要時）
  - com.amazonaws.ap-northeast-1.ec2
  - com.amazonaws.ap-northeast-1.ec2messages
  - com.amazonaws.ap-northeast-1.sts
  - com.amazonaws.ap-northeast-1.kms（必要時）

注: 実際に必要なサービスに限定し、コストと ENI 上限に配慮して選定する。

---

## 7. ロギング・オブザーバビリティ

- VPC Flow Logs: 保持期間 365 日。宛先は CloudWatch Logs（`myapp-network-logs` などの命名）を推奨。高トラフィック時は S3 も検討。
- クリティカルなネットワークコンポーネントには最低 1 つのメトリクス/アラーム/ロギング改善案を検討（例: Regional NAT のデータ処理量アラーム、エンドポイント接続失敗ログ監視）。

---

## 8. 可用性・拡張性・コスト

- 可用性: 2AZ、Regional NAT によりリージョン冗長なアウトバウンド接続を提供。IGW は VPC にアタッチされ、Regional NAT 背後のインターネット経路を提供。
- 拡張性: 追加 AZ 拡張、サブネット増設、TGW ルート追加が可能なアドレス計画とする。
- コスト: ワークロード用の Public サブネットを不要化しつつ、IGW は 1 つ作成する。従来の AZ ごとの NATGW 構成に比べ Regional NAT により運用を簡素化。ECS/ECR 等の VPC Endpoint 導入により Regional NAT のデータ処理量を抑制。

---

## 9. 非機能・コンプライアンス

- `cdk-nag` の AwsSolutionsChecks を適用し、ERROR はゼロであること。
- suppress は原則禁止。やむを得ない場合は ID と明確な理由を記載（スタック/リソース単位）。
- 単体テスト（Jest + @aws-cdk/assertions）で少なくとも以下を検証:
  - スナップショットテスト（テンプレート差分の検出）
  - リソースアサーション（VPC/Subnet/IGW/Regional NAT/Endpoints/Tags など）
  - `cdk-nag` エラーが存在しないこと
- 変更時は `cdk synth` と `cdk diff` を実施し、差分説明が可能な状態を維持。

---

## 10. 受け入れ基準（Acceptance Criteria）

1. 2AZ・6サブネット（各 AZ: Frontend, Application, Datastore）構成が作成される。
2. IGW が VPC にアタッチされ、Regional NAT が構成され、プライベート各層は Regional NAT 経由でアウトバウンド可能。
3. すべてのワークロード ENI は Private IP のみで稼働（Public IP 無し）。
4. セキュリティグループはレイヤ間最小権限。オンプレ → Internal ALB（80/443）、Internal ALB → application（必要ポート）、`application → datastore` の 6379 許可が存在。
5. 各サブネットに NACL が設定され、不要な広範許可が無い。
6. 必要な VPC Endpoint が作成され、ECS/ECR/Logs 等のプライベートアクセスが可能。
7. VPC Flow Logs が有効で、保持 365 日。
8. 必須タグ（Project/Environment/Owner/CostCenter）が全リソースに付与。
9. `cdk-nag` AwsSolutionsChecks の ERROR が 0、テストが成功する。
10. 将来の TGW 接続に備え、ルート/アドレス計画に拡張余地がある。

---

## 11. アウトオブスコープ

- TGW リソース作成、DX 接続設定
- ALB/NLB、ECS クラスタ/サービス、RDS/ElastiCache などアプリケーション層の具体リソース（本書では Internal ALB を Frontend Subnet に配置する方針のみ定め、作成はスコープ外）
- オンプレミス側ルート設定

---

## 12. 補足・設計上の注意

- フロントエンド層は「社内（オンプレ）」向けであり、インターネット公開は行わない。Internal ALB を配置し、DX/TGW 経由のトラフィックのみを受け付ける。
- データストア層は原則インターネット到達不可。メンテナンスやライセンス取得が必要な場合は踏み台/運用経路を別途設ける。
- Regional NAT はゾーン非依存で提供されるため、ルートテーブルは各プライベートサブネットのデフォルトルートを Regional NAT に向ける。AZ ローカルの NATGW を指す設計は採用しない。
- VPC CIDR は将来のマルチ VPC/TGW/オンプレ統合を考慮し、変更可能な決定事項（ADR）として管理することを推奨。

---

## 13. CDK 実装ガイダンス（本リポジトリ向け）

- スタック分割: `NetworkStack` を独立。アプリ層は別スタックから VPC を参照。
- 環境値は `env-config.ts` に一元化。`bin/` では `stage` を context/env から決定。
- `lib/constructs/` に再利用可能な VPC コンストラクトを配置し、スタックから組み立てる。
- 変更後は `npm test`・`npm run lint`・`cdk synth` を必ず実行。
