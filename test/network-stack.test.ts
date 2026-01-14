import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/network-stack';

describe('NetworkStack', () => {
  const synthTemplate = () => {
    const app = new App({ context: { stage: 'dev' } });
    const stack = new NetworkStack(app, 'myapp-dev-an1-network', {
      project: 'myapp',
      stage: 'dev',
    });
    return Template.fromStack(stack);
  };

  test('snapshot', () => {
    const template = synthTemplate();
    expect(template.toJSON()).toMatchSnapshot();
  });

  test('VPC and core networking resources exist', () => {
    const template = synthTemplate();

    // VPC with expected CIDR
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.100.0.0/16',
    });

    // IGW and NAT Gateway exist
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    const natGws = template.findResources('AWS::EC2::NatGateway');
    expect(Object.keys(natGws).length).toBeGreaterThanOrEqual(1);

    // Subnets for three tiers exist (at least 2 AZs x 3 groups = 6)
    const subnets = template.findResources('AWS::EC2::Subnet');
    expect(Object.keys(subnets).length).toBeGreaterThanOrEqual(6);

    // VPC Endpoints: Construct 定義の有無はスナップショットで確認（詳細リソースは将来の厳格化で追加）

    // Tags on VPC include Project (他のタグはスナップショットで確認)
    template.hasResourceProperties('AWS::EC2::VPC', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Project', Value: 'myapp' }),
      ]),
    });
  });
});
