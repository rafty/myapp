#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { envs, defaultStage, shortRegion } from '../lib/env-config';
import { NetworkStack } from '../lib/network-stack';

const app = new cdk.App();

// stage は context → env → default の優先で決定
const stage =
  (app.node.tryGetContext('stage') as keyof typeof envs | undefined) ??
  (process.env.CDK_STAGE as keyof typeof envs | undefined) ??
  defaultStage;

const project = 'myapp';
// env 未設定の synth（ローカル）でも命名のために既定リージョン短縮名を使用
const regionShort = shortRegion('ap-northeast-1');

// Stack 名規則: <project>-<stage>-<region>-<component>
const networkStackId = `${project}-${stage}-${regionShort}-network`;

new NetworkStack(app, networkStackId, {
  // ローカル synth では環境非依存 Stack とする（デプロイ時は CI から env を注入）
  project,
  stage,
});
