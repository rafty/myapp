変更履歴

未リリース
追加
- docs/resources.md: セキュリティ制御に焦点を当てたリソース一覧を追加
- docs/architecture.md: ハイレベルな概要と主要ポリシーを追加
- docs/network.md: ネットワーク構成とセキュリティベースラインを追加
- docs/*: ガイドラインに基づき英語から日本語へ翻訳
- docs/architecture.md, docs/network.md: Mermaid 図を追加し、構成の可視化を復元

変更
- flow-logs: 一時的な広範な許可を削除し、最小権限のステートメントを徹底（Encryption Context のスコープ、GrantIsForAWSResource、ViaService）
- flow-logs: VPC Flow Logs 用 IAM ロールを最小権限化（LogGroup と LogStreams を分離して記述）
- tests: 動的な `log-stream:*` に関する、理由を明記したピンポイントな `AwsSolutions-IAM5` の suppress を考慮するよう cdk-nag テストを調整
- snapshots: IAM ポリシー再構成に伴い更新

セキュリティ
- CloudWatch Logs 連携における KMS および IAM の最小権限を徹底
- cdk-nag のカバレッジは維持し、やむを得ない `log-stream:*` のみピンポイントに suppress

0.1.0 - 初期リリース
- Network Stack、VPC、Security Group、NACL、Endpoints（スケルトン）、Flow Logs（初期）を含むプロジェクトスケルトン