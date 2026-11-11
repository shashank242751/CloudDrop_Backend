# CloudDrop Backend – Intelligent File Transfer Engine ☁️⚙️

> **Independent, decoupled backend microservice powering the CloudDrop Intelligent File Transfer Platform.**
> Built with **NestJS**, **Swagger OpenAPI**, **Docker**, **AWS SDK v3**, and production **AWS CloudFormation** covering EC2, EBS, AMI, ASG, NLB, Apache Reverse Proxy, S3, DynamoDB, Lambda, and IAM.

Repository: [https://github.com/shashank242751/CloudDrop_Backend.git](https://github.com/shashank242751/CloudDrop_Backend.git)

---

## 🏗️ Architecture & AWS Topics Covered

- **EC2 (`t2.micro` / `t3.micro`)**: Hosts the NestJS container and Apache server.
- **EBS (8 GB `gp3`)**: Persistent storage for OS packages and container logs.
- **AMI**: Amazon Linux 2023 base + snapshot script for baking golden images.
- **Launch Template**: Manages instance launch configurations, security groups, and user-data bootstrap.
- **Auto Scaling Group (ASG)**: Maintains 1 to 2 instances with automated self-healing.
- **Network Load Balancer (NLB)**: Distributes Layer 4 traffic across public subnets in multiple AZs.
- **Apache Server**: Runs as a reverse proxy on port 80 forwarding requests to NestJS on port 3000.
- **Amazon S3**: Stores user files directly via Pre-Signed PUT and GET URLs.
- **Amazon DynamoDB**: Serverless metadata store with native TTL expiration.
- **AWS Lambda**: S3 event-driven processor extracting checksums and updating DynamoDB.
- **AWS IAM**: Least-privilege EC2 Instance Profile and Lambda roles.
- **CloudFormation**: 1-click IaC provisioning and zero-cost teardown.

---

## 📂 Repository Structure

```
backend/
├── .github/
│   └── workflows/
│       └── backend-ci-cd.yml          # GitHub Actions CI/CD Pipeline
├── docs/
│   ├── BACKEND_ARCHITECTURE.md        # Deep-dive architecture and design
│   ├── AWS_DEPLOYMENT_GUIDE.md        # Step-by-step AWS provisioning guide
│   ├── SWAGGER_API_DOCS.md            # Swagger OpenAPI documentation
│   └── ZERO_COST_GUIDE.md             # Free Tier guarantee and teardown
├── infra/
│   ├── cloudformation/
│   │   └── clouddrop-infra.yaml       # 1-Click AWS IaC Template
│   ├── apache/
│   │   └── clouddrop.conf             # Apache Reverse Proxy VirtualHost
│   └── scripts/
│       ├── user-data.sh               # EC2 bootstrap script
│       ├── create-ami.sh              # Custom AMI creation script
│       └── teardown.sh                # 100% Zero-cost cleanup script
├── lambda/
│   ├── index.js                       # S3 Event Processor Lambda
│   └── package.json
├── src/
│   ├── aws/                           # S3 & DynamoDB AWS SDK v3 integration
│   ├── files/                         # File transfer controller, DTOs & service
│   ├── app.controller.ts              # NLB / ASG Health check endpoints
│   ├── app.module.ts
│   └── main.ts                        # Swagger OpenAPI bootstrap
├── Dockerfile                         # Multi-stage production container
├── package.json
└── tsconfig.json
```

---

## ⚡ Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Start in development mode
npm run start:dev

# 3. Access Swagger Documentation
# Open: http://localhost:3000/api/docs
```

---

## 🐳 Docker Deployment

```bash
# Build image
docker build -t clouddrop-backend:latest .

# Run container
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e AWS_REGION=us-east-1 \
  -e S3_BUCKET_NAME=my-demo-bucket \
  -e DYNAMODB_TABLE_NAME=CloudDropFiles \
  clouddrop-backend:latest
```

---

## 🚀 1-Click AWS Deployment via CloudFormation

```bash
aws cloudformation create-stack \
  --stack-name clouddrop-backend-stack \
  --template-body file://infra/cloudformation/clouddrop-infra.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

To fetch the live NLB URL once deployment completes:
```bash
aws cloudformation describe-stacks \
  --stack-name clouddrop-backend-stack \
  --query "Stacks[0].Outputs" \
  --region us-east-1 \
  --output table
```

---

## 💰 Teardown ($0.00 Cost Guarantee)

```bash
chmod +x infra/scripts/teardown.sh
./infra/scripts/teardown.sh clouddrop-backend-stack us-east-1
```

For full details, see the [`docs/`](./docs) folder!
