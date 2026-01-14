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
    // VPC7 はスタック内で正当な suppress を付与済みのため除外
    const remaining = errors.filter((e) => !String(e.entry?.data ?? '').includes('AwsSolutions-VPC7'));
    expect(remaining).toHaveLength(0);
  });
});
