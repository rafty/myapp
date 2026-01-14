# myapp タスクリスト（Executable Task List）

作成日: 2026-01-14 13:05（自動生成）

本タスクリストは `requirements/plan.md` の計画に基づき、実行順に分解した詳細チェックリストです。各タスクは完了時に [x] へ更新してください。

---

## Phase 0: ブートストラップと基盤整備
1. リポジトリ現況の確認と整備
   - [x] tsconfig の strict 設定を確認し、必要に応じて有効化する
   - [x] ESLint/Prettier の設定を確認（存在する場合はルール遵守を前提に不足を補う）
   - [x] Jest のテスト実行環境を確認（スナップショット利用可否含む）
2. スクリプト整備（package.json）
   - [x] `synth` スクリプトを追加/整備
   - [x] `diff` スクリプトを追加/整備
   - [x] `test` スクリプトを追加/整備
   - [x] `lint` スクリプトを追加/整備
   - [x] `deploy:<stage>`（sbx/dev/stg/prod）を追加（`-c stage=<stage>`）
   - [x] `cdk-nag-run` スクリプトを追加
3. 環境設定テンプレート
   - [x] `lib/env-config.ts` を作成し、stage→account/region のマップを定義
   - [x] 機微情報が含まれていないことを確認

---

## Phase 1: Stack/Construct 設計とスケルトン実装
1. Stack 分割方針の反映
   - [x] `lib/network-stack.ts` を作成（単一責任: Network）
   - [x] 将来の `lib/app-stack.ts` はスコープ外である旨コメント（作成はしない）
2. Construct 設計（スケルトン）
   - [x] `lib/constructs/vpc-core.ts`（VPC, Subnet, RouteTable, IGW, Regional NAT 経路設計の骨格）
   - [x] `lib/constructs/vpc-endpoints.ts`（Gateway/Interface Endpoints の骨格）
   - [x] `lib/constructs/security.ts`（基本 SG と NACL の骨格）
   - [x] `lib/constructs/flow-logs.ts`（VPC Flow Logs + CW Logs の骨格）
3. `bin/myapp.ts` 更新
   - [x] stage 決定ロジック（context/env）を実装
   - [x] スタック命名規則 `<project>-<stage>-<region>-<component>` を反映
4. ビルド確認
   - [x] 空実装で `cdk synth` が成功することを確認

---

## Phase 2: VPC とサブネット（3-tier x 2AZ）
1. VPC/IGW
   - [x] VPC を CIDR `10.100.0.0/16`（暫定）で作成（ADR 可変性コメント付き）
   - [x] IGW を 1 つ作成し VPC にアタッチ（CDK の L2 により自動生成）
2. サブネット（各 AZ）
   - [x] Frontend `/24` を AZ A/C に 2 本
   - [x] Application `/24` を AZ A/C に 2 本
   - [x] Datastore `/24` を AZ A/C に 2 本
3. ルート/デフォルトルート
   - [x] Frontend, Application: `0.0.0.0/0` → Regional NAT へルート（L2 により自動設定）
   - [x] Datastore: 原則デフォルトルート無し（必要時のみ Regional NAT）
4. NACL（雛形）
   - [x] 各レイヤに最小権限の NACL エントリ雛形を定義
5. タグ
   - [x] 全リソースへタグ `Project=myapp`, `Environment=<stage>`, `Owner=JP-Solution`, `CostCenter=SOL-12345678` を付与
6. 合成確認
   - [x] `cdk synth` が成功することを確認

---

## Phase 3: Security（SG/NACL）
1. セキュリティグループ（SG）
   - [x] オンプレ → Internal ALB: 80/443（CIDR/Attachment 未確定のため TODO コメントで明示）
   - [x] ALB → Application: 必要ポート（80/443 等、当面はパラメータ化）
   - [x] Application → Datastore: TCP 6379 を最小範囲で許可
   - [x] 広範 CIDR 許可を避け、可能な限り SG 参照許可にする
2. NACL 詳細化（最小）
   - [x] 方向/ポート最小化の基本ルールを反映（厳格化は将来）
3. 合成確認
   - [x] `cdk synth` が成功することを確認

---

## Phase 4: VPC Endpoints（段階導入）
1. 必須エンドポイント（初期）
   - [x] Gateway: S3
   - [x] Interface: ECR API, ECR DKR, Logs, STS, EC2, EC2Messages, ECS, ECS-Agent, ECS-Telemetry
2. 任意（必要時導入、フラグ制御）
   - [x] Secrets Manager, SSM, SSM Messages, KMS, DynamoDB（Gateway）を有効化フラグで切替実装
3. エンドポイント用 SG
   - [x] 最小権限の SG を作成
4. ステージ別制御
   - [x] ステージ変数で有効/無効を切替可能に実装
5. 合成確認
   - [x] `cdk synth` が成功することを確認

---

## Phase 5: オブザーバビリティ
1. Flow Logs
   - [x] VPC Flow Logs を CloudWatch Logs に出力（保持 365 日）
2. 監視案（最小）
   - [x] Regional NAT データ処理量/エラーのメトリクス参照方針をコメント/README に記載
   - [x] VPCE 接続失敗ログの将来対応方針をコメント
3. 合成確認
   - [x] `cdk synth` が成功することを確認

---

## Phase 6: テスト／静的検査
1. Jest + @aws-cdk/assertions テスト
   - [x] スナップショットテストを追加
   - [x] リソースアサーションテストを追加（VPC/Subnet/IGW/Regional NAT/Endpoints/Tags/NACL/SG）
2. cdk-nag（AwsSolutionsChecks）
   - [x] Unit Test で `AwsSolutionsChecks` を適用し ERROR=0 を確認（VPC7 は正当理由付き suppress 適用）
   - [x] suppress は原則禁止。必要時は ID と理由をコードコメントに明記（VPC7: L2 構成誤検知のため抑止理由を明記）
3. 実行
   - [x] `npm run test` が成功することを確認（スナップショット/主要アサーション）

---

## Phase 7: ドキュメント生成
1. docs/resources.md
   - [x] スタック/Construct ごとのリソース一覧（Logical ID/Type/主要プロパティ/セキュリティ設定）を生成/更新
2. docs/architecture.md（Mermaid）
   - [x] VPC/ALB/ECS/Endpoints などの関係図を作成（ALB/ECS は方針のみでリソース未作成である旨を明記）
3. docs/network.md
   - [x] VPC/Subnet/Route Table/NAT/SG/NACL/通信フロー図（Mermaid）を作成
4. docs/CHANGELOG.md
   - [x] フェーズごとの変更履歴を追記

---

## Phase 8: CI/CD と運用
1. npm scripts の整備
   - [x] `deploy:sbx|dev|stg|prod` の動作確認（`-c stage=<stage>`）
   - [x] `synth`, `diff`, `test`, `lint`, `cdk-nag-run` の動作確認
2. 将来 CI の実行順序を README に明記
   - [x] `npm ci` → `npm run lint` → `npm run test` → `npx cdk-nag-run` → `cdk synth` → `cdk diff/deploy`

---

## 命名・タグ・ポリシーの確認（横断）
- [x] スタック名が `myapp-<stage>-an1-network` であることを確認
- [x] リソース名例（`MyappVpc`, `MyappFrontendSubnetA|C`, など）が命名規則に沿っていることを確認
- [x] タグ `Project`, `Environment`, `Owner`, `CostCenter` が全リソースへ付与されていることを確認

---

## リスクと対応（メモ/確認）
 - [x] CIDR 競合の懸念を ADR/README に記載（将来の TGW/オンプレ考慮）
 - [x] Regional NAT コスト監視の方針を記載
 - [x] SG/NACL 過剰許可の防止（cdk-nag/テストで検出）を確認（TODO/注記を追加）

---

## 受け入れ条件トレーサビリティ（最終確認）
 - [x] requirements の受け入れ基準(10項目)が Phase 2〜7 で満たされていることを確認し、対応箇所をドキュメントへ明記
