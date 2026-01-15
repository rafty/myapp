# myapp project

# Terminal 手動操作

### cdk deploy
```shell
npm run deploy:<stage>
```

### cdk destroy
```shell
cdk destroy -c stage=sbx
```
- CloudWatch Logs Group : myapp-sbx-network-logsなどを手動で削除すること
- CloudFormation Stackのリソースで削除をSkippedされたものを手動で削除すること 


---

# myapp CDK project

本リポジトリは AWS CDK (TypeScript) によるネットワーク基盤（Network Stack）を管理します。

構成の要点
- Stack 名規則: `myapp-<stage>-<regionShort>-network`（例: `myapp-dev-an1-network`）
- 環境変数: `-c stage=<stage>` または `CDK_STAGE` で切替（`lib/env-config.ts` 参照）

監視・運用方針（最小）
- Regional NAT: データ処理量/エラーのメトリクスを CloudWatch で監視（閾値は将来決定）
- VPC Endpoints: 接続失敗/エラーログはアプリ側/Flow Logs と併用して将来詳細化

CI 実行順序（将来導入時のガイドライン）
1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npx cdk-nag-run`（Phase 6 以降で適用）
5. `npm run synth`
6. `npm run diff` / `npm run deploy:<stage>`

Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npm run synth`   emits the synthesized CloudFormation template
* `npm run diff`    compare deployed stack with current state
* `npm run deploy:<stage>` deploy this stack to a specific stage


