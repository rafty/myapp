# .junie/guidelines.md
# AWS CDK TypeScript プロフェッショナルガイドライン

> このファイルは、本AWS CDK TypeScript IaC プロジェクトにおいてAIエージェント(Junie)が作業する際の  
> **行動規範（Behavior Rule）/ コーディング規約 / 設計原則 / ドキュメント生成ポリシー** を定義する。

AI は **コード作成 → テスト → ドキュメント更新 → 差分レビュー** を人間エンジニアと同等のプロフェッショナル品質で実行すること。

---

# 1. プロジェクト概要

- 使用技術：**AWS CDK v2**, **TypeScript**, Node.js LTS
- IaC 専用リポジトリ（アプリケーションコードは含まない）
- 本プロジェクトはIaC専用であるが、IaCでデプロイするLambda Functionなどのアプリケーションコードを含むこともある
- ディレクトリ構成（標準）：
    - `bin/`：エントリーポイント（Stack の組み立て）
    - `lib/`：Stack / Construct
    - `lib/constructs/`：再利用可能な Construct
    - `test/`：CDK テストコード（Jest + @aws-cdk/assertions）
    - `docs/`：自動生成ドキュメント（resources.md / architecture.md / network.md）
    - `.junie/`：AI 制御ファイル（guidelines）
    - `requirements/`：AI 制御ファイル（requirementsやplan、tasksなど）
    - `sources/`：Lambda function コード

コード生成や修正時には必ず以下を守ること：
1. AI は上記構造をを維持する。変更が必要な場合、理由を説明したうえで提案すること。
2. 本ガイドラインで定める規約に従う
3. 変更はミニマルでわかりやすく、Git 差分で理解しやすいようにする
4. `lib/`のStack、Constructで、コードが肥大化しないように`lib/constructs/`のコンストラクトを使用すること。また、コンストラクトのネーミングはわかりやすいものにすること。
5. コードのコメントは適切な日本語にすること。ただし、技術的用語や名称は適切な英語にすること。
6. ドキュメントは適切な日本語にすること。ただし、技術的用語や名称は適切な英語にすること。
7. Lambda Functionを作成する際、コードはPython V12で記述すること。

---

# 2. TypeScript コーディングスタイル

## 2.1 基本ルール
- TypeScript **strict mode** を標準とする
- `any` は原則使用禁止。必要な場合はコメントで明確に理由を記載
- コールバックや短い関数では **アロー関数** を使用
- クラス名 / Construct 名は **PascalCase**
- 変数 / 関数 / メソッドは **camelCase**
- `var` 禁止、`const` を優先し、必要な場合のみ `let` を使用
- ライブラリモジュールでは **default export より named export を優先**
- 全ての新規コードは `npm test` および `npm run lint` に合格すること

## 2.2 import ルール
- 1. 外部ライブラリ
- 2. `aws-cdk-lib`
- 3. Construct ライブラリ
- 4. ローカルファイル

## 2.3 ファイル作成
1. 新規ファイルを作成する際は、冒頭に次を含むコメントを書くこと。コメントは適切な日本語にすること。ただし、技術的用語や名称は適切な英語にすること。

```ts
/**
 * @purpose   このファイルの目的
 * @stack     対象のStack名
 * @overview  リソース概要
 */
```

---

# 3. CDK 設計原則（Stacks / Constructs）

## 3.1 Stack 設計（SRP）
- Stack は **単一責任（SRP）** を徹底する
    - 1つの Stack は 1つの目的（Network, App, DB, Monitoring）
- なぜ分けるか：
    - 変更影響範囲を限定
    - デプロイ高速化
    - cdk diff を見やすくする
    - チーム分離が可能
    - CloudFormation の安定性向上
- 推奨分割例：
    - NetworkStack / AppStack / DatabaseStack / MonitoringStack
- Cross-stack 参照は **props 経由**
    - 直接 Stack.of() で他 Stack を参照しない

## 3.2 環境（Environment）と CDK Context の扱い

### 目的
環境差分を排除し、安全なマルチアカウントでの IaC 運用を行うため、  
**環境値（stage / account / region）をコードから分離し、単一の設定レイヤーに集約する**。

### 原則
- Stack / Construct の内部に環境値をハードコードしない
- 環境値は **env-config.ts のような環境マップで一元管理**する
- CLI で毎回手動入力する必要はなく、スクリプトや CI/CD により安全に注入する
- Sandbox環境へはCLIで実行し、dev, stg, prod環境へはCI/CD により安全に注入する
- 設定値が散在しないように「環境値は **1 箇所の設定ファイル**にまとめる」

### 推奨：env-config.ts（環境マップ）で一元管理する

```ts
// env-config.ts
export const envs = {
  dev:  { account: "111111111111", region: "ap-northeast-1" },
  stg:  { account: "222222222222", region: "ap-northeast-1" },
  prod: { account: "333333333333", region: "ap-northeast-1" },
} as const;
```

このファイルのみが **環境値の唯一の定義場所**となる。  
Stack や Construct からは env-config.ts を参照するだけにする。

### bin/app.ts での読み取り例

```ts
import { envs } from "./env-config";
import * as cdk from "aws-cdk-lib";

const app = new cdk.App();

// stage は context → env → default の優先で決定
const stage =
  app.node.tryGetContext("stage") ??
  process.env.CDK_STAGE ??
  "dev";

const env = envs[stage];

new NetworkStack(app, `network-${stage}`, { env, stage });
new AppStack(app, `app-${stage}`, { env, stage });
```

### ハードコード禁止（NG 例）

```ts
// ❌ Stack 内に環境値を書くのは絶対禁止
const prodAccount = "333333333333";
const region = "ap-northeast-1";
```

理由：
- 管理箇所が分散し、変更漏れ・誤デプロイの原因になる
- マルチアカウント構成での運用に耐えない

---

### Stack 名ルール
```
<project>-<stage>-<region>-<component>
例： amyapp-prod-an1-network
```

### Region 名ルール
```
<region>
例： ap-northeast-1 -> an1
例： ap-northeast-3 -> an3
```

---

### ARN / Account / Region の取得方法（Stack 内）

```ts
Stack.of(this).account
Stack.of(this).region
```

Stack 内では fixed value を書かず、CDK が持つ実行環境情報を使う。

---

### 補足：手動で `cdk deploy -c` を打つ運用は推奨しない
- 人間が毎回パラメータを打つと **タイプミスによる誤デプロイ**が起こる
- npm scripts や CI/CD ジョブ側で固定化し、安全に注入する

例：package.json
```json
{
  "scripts": {
    "deploy:dev": "cdk deploy -c stage=dev",
    "deploy:prod": "cdk deploy -c stage=prod"
  }
}
```

## 3.3 Construct 設計
- 再利用されるパターンは `lib/constructs/` に配置する
- Construct 内に **業務ロジックを含めない**（IaC のみ）

## 3.4 L2/L3 Construct 優先
- L1 Construct は原則使用しない
- L1 を使う場合は、理由をコメントに明記すること

---

# 4. 命名規則（Naming）

## 4.1 リソース名
```
<Project><Component><Purpose>
例： BluVpcPrivateSubnet01
```

## 4.2 Stack 名
```
<project>-<stage>-<region>-<component>
例： aiapp-prod-an1-network
```

## 4.3 その他
- SecurityGroup 名： `<Project><Component>SG`
- LogGroup 名： `<project>-<component>-logs`

---

# 5. セキュリティ & ガバナンス（静的コンプライアンスチェック cdk-nag）

## 5.1 IAM 最小権限
- IAM ポリシーは最小権限
- `*` の使用は禁止（やむを得ない場合は理由をコメントに明記）

## 5.2 Secrets 管理
- Secrets Manager / SSM Parameter Store（SecureString）を使用
- secrets を Git に commit してはならない

## 5.3 ネットワーク
- Private Subnet を優先
- Security Group は inbound/outbound を必要最小限に制限
- SubnetにNetwork ACLは必須
- Public Subnet の使用は明確な理由がある場合のみ
- ワークロードは可能な限りプライベートサブネットで稼働
- ワークロードはfrontend、 application、datastoreのThree Tier Architectureにすること
- オンプレミスからしかアクセスしないワークロードでもThree Tier Architectureにすること
- プライベートサブネットからAWSサービスにアクセスするには、必ずVPC Endpointを使用すること

## 5.4 タグ
- 最低限付与すべきタグ：`Project`, `Environment`, `Owner`, `CostCenter`

## 5.5 静的コンプライアンスチェック cdk-nag

### 目的
デプロイ前に **セキュリティ違反・IAM 過剰権限・ベストプラクティス違反** を検出し、自動的に修正またはレビュー可能な形にする。

## 🔍 適用範囲
- すべての Stack
- すべての Construct
- すべての AWS リソース
    - VPC / Subnet / Route / NAT
    - Security Group
    - IAM
    - Lambda
    - ECS / Fargate
    - RDS
    - CloudWatch Logs
    - その他 CDK が生成するリソース全て

## 📚 適用ルールセット
- **AwsSolutionsChecks**（必須）
- プロジェクト要件に応じて追加：
    - NIST80053R5Checks
    - HIPAA Security Checks

## 🚫 強制ポリシー
- **cdk-nag が ERROR を出した状態ではデプロイしてはならない**
- WARN の場合も、内容によっては修正対象
- suppress（抑止）は原則禁止

## ✅ suppress が必要になる例
以下すべてを満たす場合のみ suppress を許可：

1. AWS 公式ドキュメントに基づく明確な理由がある
2. 代替手段が存在しない
3. 第三者が理解できる理由文を記載する
4. suppress ID を正しく指定する（誤った ID は禁止）

## ✏ suppress の正しい記述例

```ts
NagSuppressions.addResourceSuppressions(this.role, [
  {
    id: 'AwsSolutions-IAM5',
    reason: 'CloudWatch Logs への書き込みに必要な AWS 推奨のワイルドカードポリシーのため'
  },
]);
```

## ❌ suppress の禁止例（AI がやりがち）

```ts
NagSuppressions.addStackSuppressions(this, [
  { id: '*', reason: 'とりあえず suppress' }
]);
```

※ ID に `*` を使う suppress は **全面禁止**（レビュー通過不可）

## テストとの連携

CDK Unit Test（Jest 等）において、`cdk-nag` エラーが存在しないことを検証するテストを最低 1 本追加すること。

```ts
import { App, Aspects, Annotations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { MyStack } from '../lib/my-stack';

test('cdk-nag による AwsSolutionsChecks エラーがないこと', () => {
  const app = new App();
  const stack = new MyStack(app, 'TestStack');

  Aspects.of(stack).add(new AwsSolutionsChecks({ verbose: true }));

  const errors = Annotations.fromStack(stack).findError('*');
  expect(errors).toHaveLength(0);
});
```


## 🧪 CI/CD での cdk-nag 自動チェック

Pipeline では必ず以下を実行する：

```
npm run test
npx cdk-nag-run
cdk synth
```

- エラー 1 件でもデプロイ不可
- suppress がある場合はレビューで理由を精査すること

## 🤖 AI 動作ポリシー
AI はコード生成後、自動的に以下を行う：

1. **cdk-nag を実行**
2. 発生したエラーを解析して修正案を提示
3. suppress が必要な場合は **理由を明記した上で** PR に記述
4. 誤った suppress（ワイルドカード・理由なし）は使用しない

---

# 6. オブザーバビリティ
- 新規リソース追加時は以下を検討：
    - CloudWatch Logs：`<project>-<component>-logs`
    - クリティカルなコンポーネントには CloudWatch アラーム
- 新リソース追加時は最低 1 つ：
    - メトリクス
    - アラーム
    - ロギング改善  
      を提案する

---

# 7. テスト & バリデーション

## 7.1 テスト必須ルール
新しい Stack または主要な Construct を作成する際は、必ず対応するテストファイル（Jest +
@aws-cdk/assertions）を追加すること。

すべての Stack および主要 Construct について **2 種類のテスト**を必須とする：

### ① スナップショットテスト
```
expect(template).toMatchSnapshot();
```

### ② リソースアサーションテスト
```
expect(template).toHaveResource('AWS::Lambda::Function');
```

## 7.2 テスト内容
- リソース作成
- インスタンスタイプ
- サブネット種別
- タグ
- IAM ポリシー
- 環境変数（Lambda, ECS）

## 7.3 Synth / Diff
AI はコード変更後に自動で：
- `cdk synth` を実行（テンプレートの妥当性確認）
- `cdk diff` の結果を読み取り、差分を説明

---

# 8. ドキュメント自動生成（AI 必須作業）

AI はコード変更後、以下のファイルを **必ず生成・更新**する。

### 8.1 docs/resources.md
- Stack / Construct ごとのリソース一覧
- Logical ID / Type / 主要プロパティ / セキュリティ設定

### 8.2 docs/architecture.md
- 全体構成図（Mermaid）
- VPC / ALB / ECS / Lambda / RDS / SNS/SQS / API Gateway の関係図

### 8.3 docs/network.md
- VPC
- Subnet
- Route Table
- NAT Gateway
- Security Group
- 通信フロー図（Mermaid）

### 8.4 docs/CHANGELOG.md
- リソース追加・変更内容を追記

> ※ これらのファイルが存在しない場合、AI は自動で新規作成すること。

---

# 9. PR（Pull Request）ルール

AI が作成する PR には以下を含める：

- 変更内容のサマリ
- 追加されたリソース一覧
- security への影響
- 既存システムとの互換性
- cdk-nag の結果
- テスト結果
- 生成したドキュメントへのリンク

---

# 10. AI の動作指針

## 10.1 一般動作
AI は以下の順序で行動する：

- 既存コードを解析
- 小さくレビュー可能な単位でコードを編集
- テストを生成・更新
- ドキュメントを生成・更新
- cdk-nag を実行

## 10.2 セーフティルール

AI エージェントは以下を **禁止**：

- 明示的指示なしに Stack やリソースの大規模削除
- 本番クリティカルな設定変更（CIDR、バックアップ設定、暗号化設定など）
- 公開 API 変更やリソース名変更を、移行計画なしで実行

曖昧・危険な要件がある場合：
- コードに `// TODO: 人間に確認が必要: <内容>` を追加
- **保守的な実装**を優先

---

# 11. 追加のベストプラクティス

- Construct の依存性は props で渡す（直接参照しない）
- コメントは「なぜ必要か」を書く
- スタック間でリソースネーミングを統一
- リージョン・アカウント ID のハードコード禁止  
  -デプロイ前に `npm run lint` を実行
- 大きな変更は RFC を作成し `docs/` 配下に保存

# 12. スタイル & 品質ツール

これらのツールがプロジェクトに設定されている場合、
AI エージェントは必ず尊重する：

- ESLint：ルールを無効化せず、修正すること
- Prettier：フォーマットを遵守
- cdk-nag：警告が出た場合、無視せず修正または理由を記載
