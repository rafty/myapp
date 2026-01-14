CHANGELOG

Phase 0
- 初期監査（tsconfig strict, Jest 確認）
- npm scripts 整備（synth/diff/test/lint/deploy/cdk-nag-run）
- env-config.ts 追加

Phase 1
- NetworkStack/Constructs 骨格
- bin/myapp.ts の stage 解決/命名規則
- 空実装 synth 成功

Phase 2
- VPC 10.100.0.0/16、2AZ、Egress/Public + Frontend/Application/Datastore (/24)
- NAT GW x2、IGW x1、ルート（L2 自動）
- タグ付与

Phase 3
- SG: ALB（TODO: on-prem CIDR）、ALB→App 80/443、App→Datastore 6379
- NACL 雛形

Phase 4
- VPCE: 必須一式 + Optional（stage 切替）

Phase 5
- Flow Logs → CloudWatch Logs（保持 365 日）
- 監視方針（NAT 指標、VPCE 失敗ログ）を README へ

Phase 6
- Jest: スナップショット + 主要アサーション
- cdk-nag: 次フェーズ

Phase 7
- docs: resources/architecture/network 追加

Phase 8
- CI 実行順ガイドを README へ