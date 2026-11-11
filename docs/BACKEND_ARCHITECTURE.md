# CloudDrop Backend Architecture Specification

```
                                      +---------------------------------------------+
                                      |                 Client                      |
                                      |         (React Frontend / External)         |
                                      +----------------------+----------------------+
                                                             |
                     +---------------------------------------+---------------------------------------+
                     | 1. Request Upload URL / Query Metadata| 3. Direct Upload / Download via S3   |
                     |    & Swagger API Calls (/api/docs)    |    Pre-Signed URLs (Zero EC2 Bandwidth)
                     v                                       v
      +------------------------------+             +-----------------------------------+
      | Network Load Balancer (NLB)  |             |         Amazon S3 Bucket          |
      |   - High-throughput TCP (L4) |             |     - Multi-GB Object Store       |
      |   - Multi-AZ (Subnets 1 & 2) |             |     - Direct Presigned Uploads    |
      +--------------+---------------+             +-----------------+-----------------+
                     |                                               |
                     | Forwards Port 80                              | 4. S3 ObjectCreated Event
                     v                                               v
      +------------------------------+             +-----------------------------------+
      | Auto Scaling Group (ASG)     |             |         AWS Lambda Function       |
      |   - Launch Template          |             |   - Extracts Size, MIME, ETag     |
      |   - EC2 Instances (t2.micro) |             |   - Computes Checksum             |
      |   - gp3 EBS Volume           |             +-----------------+-----------------+
      |   - IAM Instance Profile     |                               |
      +--------------+---------------+                               |
                     |                                               |
             Inside EC2 Instance:                                    |
      +-----------------------------------------+                    |
      | [Apache Server (httpd)]                 |                    |
      |   - Listens on Port 80                  |                    |
      |   - Reverse Proxy: /api, /health, /docs |                    |
      |   - Proxies to 127.0.0.1:3000           |                    |
      +------------------+----------------------+                    |
                         |                                           |
                         v                                           |
      +-----------------------------------------+                    |
      | [Docker Container - NestJS Backend]     |                    |
      |   - Port 3000                           |                    |
      |   - Swagger OpenAPI (/api/docs)         |                    |
      |   - AWS SDK v3 (IAM Instance Profile)   |                    |
      +------------------+----------------------+                    |
                         |                                           |
                         | 2. Persist File Metadata & Expiration     | 5. Mark Status READY
                         +--------------------+----------------------+
                                              |
                                              v
                               +-----------------------------+
                               |      Amazon DynamoDB        |
                               |  - File Metadata & Stats    |
                               |  - TTL Automatic Expiration |
                               |  - 100% Free Tier           |
                               +-----------------------------+
```

---

## 🏗️ Deep Dive: The 11 AWS Topics in CloudDrop Backend

### 1. EC2 Instance (Elastic Compute Cloud)
- **Role**: Computes and manages file transfer sessions and API calls.
- **Instance Type**: `t2.micro` or `t3.micro`.
- **AWS Free Tier**: Qualifies for **750 hours per month free**.

### 2. EBS Volume (Elastic Block Store)
- **Role**: Persistent block storage attached to each EC2 instance.
- **Specification**: 8 GB `gp3` root volume for OS packages, Apache logs, and Docker images.
- **AWS Free Tier**: AWS provides **30 GB of EBS storage free forever**.

### 3. AMI (Amazon Machine Image)
- **Base AMI**: Dynamically queried via AWS SSM Parameter Store: `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`.
- **Custom Golden AMI**: Use the included script `infra/scripts/create-ami.sh` to capture a pre-baked image with Docker and Apache pre-installed, reducing ASG boot time to < 30 seconds.

### 4. Launch Template
- Encapsulates instance provisioning configurations:
  - Instance Type: `t2.micro`
  - AMI ID
  - IAM Instance Profile attachment
  - Security Groups (Port 80 HTTP, Port 22 SSH)
  - User-Data bootstrap script installing Apache, Docker, and running the container.

### 5. ASG (Auto Scaling Group)
- **Configuration**: Min: 1, Max: 2, Desired: 1.
- **Self-Healing**: Coupled with the NLB Target Group using `HealthCheckType: ELB`. If an EC2 instance fails the `/health` check, the ASG terminates the instance and spawns a fresh replacement automatically.

### 6. NLB (Network Load Balancer)
- **Layer 4 High Throughput**: Operates at the transport layer (TCP), forwarding traffic with sub-millisecond latency.
- **High Availability**: Deployed across 2 Public Subnets in different Availability Zones.
- **Target Group**: Forwards incoming port 80 traffic to the EC2 instances on port 80.

### 7. Apache HTTP Server (Reverse Proxy)
- **Configuration**: `/etc/httpd/conf.d/clouddrop.conf`.
- **Role**: Listens on port 80 and reverse-proxies:
  - `/api` -> `http://127.0.0.1:3000/api`
  - `/api/docs` -> `http://127.0.0.1:3000/api/docs`
  - `/health` -> `http://127.0.0.1:3000/health`
- **Why Apache?** Isolates Node.js from direct public exposure, handles connection buffering, and standardizes logging.

### 8. Amazon S3 (Simple Storage Service)
- **Architecture Benefit**: Files are never passed through EC2 memory or bandwidth.
- **Pre-Signed URLs**: The backend issues a cryptographically signed PUT URL. The client browser uploads directly to S3.
- **CORS Configuration**: Configured with `PUT`, `GET`, `HEAD` origins for cross-origin browser uploads.

### 9. Amazon DynamoDB (NoSQL)
- **Table**: `clouddrop-demo-files` with partition key `fileId` (String).
- **Billing Mode**: `PAY_PER_REQUEST` (On-Demand) = $0 idle cost.
- **DynamoDB TTL (Time-To-Live)**: The `expiresAt` attribute stores a Unix timestamp. DynamoDB's background scanner automatically purges expired records at zero compute cost.

### 10. AWS Lambda File Processor
- **Event-Driven**: Triggered on `s3:ObjectCreated:*`.
- **Execution**: Extracts object size, ETag checksum, and MIME type, then marks the file record status as `READY` in DynamoDB.

### 11. AWS IAM & CloudFormation
- **IAM Instance Profile**: Allows EC2 to call S3 and DynamoDB without hardcoding AWS access keys.
- **CloudFormation**: 100% of the above resources are declared in `infra/cloudformation/clouddrop-infra.yaml`.
