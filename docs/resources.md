# Resources Summary

This document lists key resources provisioned by `NetworkStack` with a focus on security controls.

## Stacks / Constructs
- Stack: `myapp-<stage>-an1-network`
  - Constructs:
    - `VpcCore`: VPC, Subnets (Frontend/Application/Datastore), NAT GW, IGW
    - `SecurityBaseline`: SG (ALB/App/Datastore/VPCE), NACL (Frontend/Application/Datastore)
    - `VpcEndpoints`: Interface/Gateway endpoints (skeleton)
    - `FlowLogs`: CloudWatch Logs + KMS encryption, VPC Flow Logs (ALL)

## CloudWatch Logs
- LogGroup: `myapp-network-logs`
  - Retention: 1 year
  - KMS: Customer Managed Key (this stack)

## KMS Key (CloudWatch Logs Encryption)
- Key Rotation: Enabled
- Key Policy (least privilege):
  - Allow CWL service principal `logs.<region>.amazonaws.com` to use Encrypt/Decrypt/ReEncrypt*/GenerateDataKey* limited by Encryption Context of `myapp-network-logs` (and its streams)
  - Allow `kms:CreateGrant`/`kms:DescribeKey` with `kms:GrantIsForAWSResource=true`
  - Allow account root with `kms:ViaService = logs.<region>.amazonaws.com` and `kms:CallerAccount = <account>`

## IAM for VPC Flow Logs
- Role: `VpcFlowLogsRole`
  - Trust: `vpc-flow-logs.amazonaws.com`
  - Inline Policy (explicit):
    - Allow `logs:CreateLogStream`, `logs:DescribeLogStreams` on LogGroup ARN only
    - Allow `logs:PutLogEvents` on `log-group:...:log-stream:*` (CWL spec requires wildcard for dynamic log streams)
  - cdk-nag: Precise suppression applied only for `PutLogEvents` on `log-stream:*` with documented reason
