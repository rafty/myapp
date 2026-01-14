Architecture Overview

Summary
- VPC with three subnet groups: Frontend, Application, Datastore
- Security groups and NACLs provide a baseline of least privilege
- VPC Flow Logs deliver to CloudWatch Logs with a stack-managed KMS key
- IAM for Flow Logs role is scoped to specific LogGroup/LogStreams

Key policies
- KMS key policy is least-privileged: Encryption Context bound to the specific LogGroup, CreateGrant/DescribeKey limited with GrantIsForAWSResource, and ViaService for the account root.
