Network Overview

VPC
- CIDR: 10.100.0.0/16
- Subnet groups: Frontend, Application, Datastore (≥ 2 AZs)

Internet/NAT
- Internet Gateway attached
- NAT Gateway present (≥1)

Security Groups
- ALB SG: allow 443 from corp/on‑prem ranges
- App SG: only ALB 80 inbound; egress only to VPCE SG:443
- VPCE SG: no ingress; egress 443 only
- Datastore SG: allow 6379 from App SG

NACLs (skeleton)
- Frontend: allow corp ephemeral in/out
- Application: allow from VPC 80/443 in; ephemeral out
- Datastore: allow from VPC 6379 in; ephemeral out

Flow Logs
- Destination: CloudWatch Logs LogGroup `myapp-network-logs`
- Retention: 365 days
- Encryption: KMS CMK (rotation enabled)
- IAM role: least privilege to LogGroup/LogStreams
