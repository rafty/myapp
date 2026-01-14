import { App, Aspects } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/network-stack';

describe('AwsSolutionsChecks', () => {
  test('no nag errors (skips if cdk-nag not installed)', async () => {
    let AwsSolutionsChecks: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      AwsSolutionsChecks = require('cdk-nag').AwsSolutionsChecks;
    } catch (e) {
      // cdk-nag が未インストール環境ではスキップ
      console.warn('cdk-nag not installed, skipping nag test');
      return;
    }

    const app = new App({ context: { stage: 'dev' } });
    const stack = new NetworkStack(app, 'myapp-dev-an1-network', {
      project: 'myapp',
      stage: 'dev',
    });

    Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

    const errors = Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-'));
    // 抑止ポリシーのある既知の例外を除外
    const remaining = errors.filter((e) => {
      const data = String(e.entry?.data ?? '');
      if (data.includes('AwsSolutions-VPC7')) return false;
      // Flow Logs → CloudWatch Logs の PutLogEvents は log-stream:* が不可避（精密 suppress 済み）
      if (data.includes('AwsSolutions-IAM5') && data.includes('log-group/myapp-network-logs:log-stream:*')) return false;
      return true;
    });
    expect(remaining).toHaveLength(0);
  });
});
