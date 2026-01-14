以下の要件を満たすVPCを作成してください。

- Project名は`myapp`としてください。
- 作成したVPCにはAWS ECS Clusterを配置します。  
- AWS ECS Cluster上のワークロードは、Direct Connect, Transit 
  Gateway経由でオンプレミスからアクセスされます。Internet Gatewayからのアクセスは必要ありません。
- AWS ECS Cluster上のワークロードのOutboundは、NAT Gateway経由でInternetにアクセスします。
- Subnetは、`frontend`、`application`、`datastore`のThree-tier-architectureにします。
- datastore 層のポート番号は6379です。
- Security Groupの設定は、必要最低限にします。
- Network ACLの設定は必要最低限にします。
- ２つのAZを使用するマルチAZ構成にしてください。
- NAT Gatewayは安定性のために各AZに配置します。
- AWSのマネージド・サービスへのアクセスはVPC EndPoint経由でアクセスします。
- AWS Accountは`sbx`環境(Sandbox環境)で`338456725408`を使用します。
- `dev`環境、`stg`環境、`prod`環境は暫定的に`111111111111
`、`222222222222`、`333333333333`のAWS Accountを使用します。
- Regionは`ap-northeast-1`です。
- Stageは`sbx`、`dev`、`stg`、`prod`です。
- デフォルトプロファイルの一つのAWSアカウントに、Stage毎にVPCを作成してください。
- 将来的にTransit Gateway経由でワークロードにオンプレミスからアクセスしますが、本要件では、Transit Gateway関連を作成しません。
- NAT GatewayはSubnet外に作成して、Outbound通信でIGWとつながります。
- オンプレミスのCIDRは暫定的に`10.0.0.0/8`にしてください。
- Flow Logs の保持期間は365日とします。
- タグは、`Project`: `myapp`, `Owner`: `JP-Solution`、`CostCenter`: 
  `SOL-12345678`とします。
- タグの`Environment`は`sbx | dev | stg | prod`のどれかです。