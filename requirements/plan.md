# myapp 改善計画（Implementation Plan）

本計画は `requirements/requirements.md` で定義されたネットワーク要件を、AWS CDK v2（TypeScript）で安全かつ段階的に実装・検証・運用へ移行するための詳細な実行計画である。ガバナンス/セキュリティ/テスト/ドキュメント生成を含む包括的なタスク分解を提供する。

---

## 1. ゴール / 成果物

- NetworkStack（2AZ, 3-tier x 2AZ, IGW, Regional NAT, NACL, SG, VPC Endpoints, Flow Logs）を CDK で実装
- `env-config.ts` による環境一元管理と `bin/` からの stage 解決
- 再利用可能な VPC Construct（`lib/constructs/`）
- `cdk-nag`（AwsSolutionsChecks）エラーゼロ、Jest テスト一式
- 自動ドキュメント（docs/resources.md, docs/architecture.md, docs/network.md, docs/CHANGELOG.md）
- 将来の TGW 接続に備えたルート/アドレス計画の拡張余地

---

## 2. 前提 / 非機能

- ステージ: `sbx`, `dev`, `stg`, `prod`（全て ap-northeast-1）
- 命名規則/タグ付けは requirements に準拠
- インターネットからの ingress は不要（DX/TGW 前提の Internal 構成）
- Regional NAT を使用し、プライベート層のデフォルトルートは Regional NAT へ
- `cdk-nag` の ERROR は 0 であること（suppress は原則禁止）

---

## 3. フェーズ別計画

### Phase 0: ブートストラップと基盤整備
- リポジトリ現況の確認と整備
  - tsconfig の strict 設定確認/整備
  - ESLint/Prettier 設定確認（存在する場合は順守）
  - Jest テスト実行環境の確認
- スクリプト整備（package.json）
  - `synth`, `diff`, `test`, `lint`, `deploy:<stage>`, `cdk-nag-run` を追加/整備
- env 設定テンプレート作成
  - `lib/env-config.ts`: stage→account/region のマップ
  - 機微情報は含めない

成果物: ビルド/テストが実行できる状態、env マップ雛形

---

### Phase 1: Stack/Construct 設計とスケルトン実装
- Stack 分割方針の反映
  - `lib/network-stack.ts`（単一責任: Network）
  - 将来の `lib/app-stack.ts`（別途、VPC 参照のみ; 本フェーズでは作成しない）
- Construct 設計
  - `lib/constructs/vpc-core.ts`（VPC, Subnet, RouteTable, IGW, Regional NAT の経路設計を含む骨格）
  - `lib/constructs/vpc-endpoints.ts`（Gateway/Interface Endpoints）
  - `lib/constructs/security.ts`（SG と NACL 基本セット）
  - `lib/constructs/flow-logs.ts`（VPC Flow Logs + CW Logs）
- `bin/myapp.ts` 更新
  - stage 決定ロジック（context/env）
  - 命名: `<project>-<stage>-<region>-<component>`

成果物: 空実装（最小）で synth 可

---

### Phase 2: VPC とサブネット（3-tier x 2AZ）
- VPC
  - CIDR 暫定 `10.100.0.0/16`（ADR として可変性を保持）
  - IGW を 1 つ作成・アタッチ
- Subnet（各 AZ）
  - Frontend `/24`（Internal ALB 用）
  - Application `/24`（ECS タスク）
  - Datastore `/24`（Redis 相当想定）
- ルート/デフォルトルート
  - Frontend, Application: `0.0.0.0/0` → Regional NAT
  - Datastore: 原則デフォルトルート無し（必要な場合のみ Regional NAT へ）
- NACL（最小権限の雛形; 実サービス移行時に詳細化）

成果物: 2AZ/6サブネット構成

---

### Phase 3: Security（SG/NACL）
- SG（最小権限）
  - オンプレ → Internal ALB: 80/443（CIDR/Attachment は後段接続時に具体化; 当面はプレースホルダ TODO コメント）
  - ALB → Application: 必要ポート（80/443 等、当面はパラメータ化）
  - Application → Datastore: TCP 6379
  - 広範 CIDR 許可は不可。SG 参照を優先。
- NACL
  - 方向/ポート最小化の基本ルールのみ定義（詳細は導入時に厳格化）

成果物: レイヤ間通信の最小経路を SG/NACL で表現

---

### Phase 4: VPC Endpoints（段階導入）
- 必須（初期）
  - Gateway: S3
  - Interface: ECR API/DKR, Logs, STS, EC2, EC2Messages, ECS, ECS-Agent, ECS-Telemetry
- 任意（必要時導入）
  - Secrets Manager, SSM, SSM Messages, KMS, DynamoDB（Gateway）
- エンドポイント SG は最小権限で作成
- コスト/ENI 上限を考慮し、ステージにより有効化フラグで制御

成果物: ECS/ECR/Logs へのプライベート到達性

---

### Phase 5: オブザーバビリティ
- VPC Flow Logs（CloudWatch Logs 推奨, 保持 365 日）
- 重要メトリクス/アラーム案
  - Regional NAT データ処理量/エラー
  - VPCE 接続失敗ログ（将来追加）

成果物: Flow Logs と最小限の監視土台

---

### Phase 6: テスト／静的検査
- Jest + @aws-cdk/assertions
  - スナップショットテスト
  - リソースアサーション（VPC/Subnet/IGW/Regional NAT/Endpoints/Tags/NACL/SG）
- cdk-nag（AwsSolutionsChecks）
  - Unit Test で ERROR=0 を確認
  - suppress は原則禁止。必要時は ID/理由を明記

成果物: `npm test` 成功、`cdk-nag` エラーゼロ

---

### Phase 7: ドキュメント生成
- docs/resources.md
  - スタック/Construct ごとのリソース一覧、Logical ID/Type/主要プロパティ/セキュリティ設定
- docs/architecture.md（Mermaid 図）
  - VPC/ALB/ECS/LB Target/Endpoints の関係（ALB/ECS は方針のみ。実リソースは未作成）
- docs/network.md
  - VPC/Subnet/Route Table/NAT/SG/NACL/通信フロー図（Mermaid）
- docs/CHANGELOG.md
  - フェーズごとの変更履歴

成果物: ドキュメント 4 点を自動/半自動生成

---

### Phase 8: CI/CD と運用
- npm scripts
  - `deploy:sbx|dev|stg|prod`（`-c stage=...`）
  - `synth`, `diff`, `test`, `lint`, `cdk-nag-run`
- 将来的な CI での自動実行順序
  - `npm ci`
  - `npm run lint`
  - `npm run test`
  - `npx cdk-nag-run`
  - `cdk synth`
  - 実行環境に応じて `cdk diff` / `cdk deploy`

成果物: デプロイ自動化の下地

---

## 4. 実装詳細設計（抜粋）

### 4.1 env-config.ts
```ts
// env-config.ts
export const envs = {
  sbx:  { account: '338456725408', region: 'ap-northeast-1' },
  dev:  { account: '111111111111', region: 'ap-northeast-1' },
  stg:  { account: '222222222222', region: 'ap-northeast-1' },
  prod: { account: '333333333333', region: 'ap-northeast-1' },
} as const;
export type Stage = keyof typeof envs;
```

### 4.2 bin/myapp.ts（例）
```ts
import * as cdk from 'aws-cdk-lib';
import { envs } from '../lib/env-config';
import { NetworkStack } from '../lib/network-stack';

const app = new cdk.App();
const stage = (app.node.tryGetContext('stage') ?? process.env.CDK_STAGE ?? 'sbx') as keyof typeof envs;
const env = envs[stage];

new NetworkStack(app, `myapp-${stage}-an1-network`, { env, stage });
```

### 4.3 Construct の責務
- vpc-core.ts: VPC/IGW/サブネット/ルート（Regional NAT 前提のデフォルトルート設計）
- vpc-endpoints.ts: Gateway/Interface Endpoints と SG
- security.ts: レイヤ間 SG と NACL（テンプレート）
- flow-logs.ts: Flow Logs と CW Logs（保持 365 日）

---

## 5. 命名・タグ・ポリシー（実装ルール）

- スタック名: `myapp-<stage>-an1-network`
- リソース名例:
  - VPC: `MyappVpc`
  - Subnet: `MyappFrontendSubnetA|C`, `MyappApplicationSubnetA|C`, `MyappDatastoreSubnetA|C`
- タグ（全リソースに適用）
  - `Project=myapp`, `Environment=<stage>`, `Owner=JP-Solution`, `CostCenter=SOL-12345678`

---

## 6. リスクと対応

- CIDR 競合（将来の TGW/オンプレ）
  - 対応: ADR で管理、テスト/VPC 分離環境で早期検証
- Regional NAT の料金増
  - 対応: 必須 VPCE を導入しデータ処理量を抑制、メトリクス監視
- SG/NACL の過剰許可
  - 対応: cdk-nag とテストで検出、CIDR ベース許可を回避し SG 参照を活用

---

## 7. 受け入れ条件トレーサビリティ

requirements の受け入れ基準(10項目)に対し、以下フェーズで満たす：
- 1/2/3/4/5/6/7/8/9/10 → Phase 2〜7 で順次満たす（詳細は各フェーズの成果物を参照）

---

## 8. 備考（TODO）

- オンプレ CIDR/Attachment の具体値は未確定のため、SG/NACL で TODO コメントを残す
- ALB/ECS などアプリ層の具体リソースはスコープ外（アーキ図では方針のみ反映）
- IPv6/Egress-Only IGW の要否は別検討（将来要件に応じて）
