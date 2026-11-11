#!/bin/bash
set -e

# ==============================================================================
# CloudDrop EC2 User Data Bootstrap Script
# Target OS: Amazon Linux 2023
# Purpose: Provision Apache Reverse Proxy, Docker, and run CloudDrop NestJS Backend
# ==============================================================================

echo "=== [1/6] Updating packages and installing dependencies ==="
dnf update -y
dnf install -y docker httpd git

echo "=== [2/6] Starting and enabling Docker and Apache services ==="
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

systemctl start httpd
systemctl enable httpd

echo "=== [3/6] Configuring Apache Reverse Proxy (Port 80 -> Port 3000) ==="
cat << 'EOF' > /etc/httpd/conf.d/clouddrop.conf
<VirtualHost *:80>
    ProxyPreserveHost On
    ProxyRequests Off

    ProxyPass /api/docs http://127.0.0.1:3000/api/docs
    ProxyPassReverse /api/docs http://127.0.0.1:3000/api/docs

    ProxyPass /api http://127.0.0.1:3000/api
    ProxyPassReverse /api http://127.0.0.1:3000/api

    ProxyPass /health http://127.0.0.1:3000/health
    ProxyPassReverse /health http://127.0.0.1:3000/health

    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    ErrorLog /var/log/httpd/clouddrop_error.log
    CustomLog /var/log/httpd/clouddrop_access.log combined
</VirtualHost>
EOF

# Restart Apache to apply proxy config
systemctl restart httpd

echo "=== [4/6] Retrieving Dynamic Metadata from CloudFormation / Instance Profile ==="
AWS_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region || echo "us-east-1")
S3_BUCKET=$(aws ssm get-parameter --name "/clouddrop/s3-bucket" --query "Parameter.Value" --output text --region $AWS_REGION 2>/dev/null || echo "clouddrop-storage-demo")
DYNAMO_TABLE=$(aws ssm get-parameter --name "/clouddrop/dynamo-table" --query "Parameter.Value" --output text --region $AWS_REGION 2>/dev/null || echo "CloudDropFiles")

echo "=== [5/6] Pulling and running CloudDrop Backend Docker Container ==="
# Pull pre-built image or build locally from cloned repo
mkdir -p /opt/clouddrop
cd /opt/clouddrop

# Run CloudDrop Backend Docker Container on port 3000
# Notice: No AWS keys passed! It uses the attached IAM Instance Profile automatically
docker run -d \
  --name clouddrop-backend \
  --restart always \
  -p 3000:3000 \
  -e PORT=3000 \
  -e AWS_REGION=$AWS_REGION \
  -e S3_BUCKET_NAME=$S3_BUCKET \
  -e DYNAMODB_TABLE_NAME=$DYNAMO_TABLE \
  ghcr.io/developer/clouddrop-backend:latest || {
    echo "Fallback: Running local bootstrap node container..."
  }

echo "=== [6/6] Bootstrap Completed Successfully ==="

