Changelog

Unreleased
Added
- docs/resources.md: Resource inventory focused on security controls
- docs/architecture.md: High-level overview and key policies
- docs/network.md: Network layout and security baseline

Changed
- flow-logs: Minimized KMS Key policy by removing temporary broad permission and enforcing least-privileged statements (EncryptionContext scoping, GrantIsForAWSResource, ViaService)
- flow-logs: Refactored VPC Flow Logs IAM role to least privilege (separate statements for LogGroup vs LogStreams)
- tests: Adjusted cdk-nag test to exclude documented, precisely-suppressed `AwsSolutions-IAM5` related to dynamic `log-stream:*`
- snapshots: Updated due to IAM policy restructuring

Security
- Enforced least privilege on KMS and IAM for CloudWatch Logs integration
- cdk-nag coverage retained; precise suppression only for unavoidable `log-stream:*`

0.1.0 - Initial
- Project skeleton with Network stack, VPC, SG, NACL, endpoints (skeleton), Flow Logs (initial)