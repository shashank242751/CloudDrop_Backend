# CloudDrop Backend AWS Deployment Guide 🚀

This guide explains how to deploy the entire backend infrastructure on AWS using CloudFormation, verify all endpoints, and execute interview demonstration scenarios.

---

## 1. Prerequisites

- AWS CLI installed and configured (`aws configure`).
- AWS Account with Administrator or PowerUser access.
- (Optional) Git installed to push to GitHub.

---

## 2. Deploy with AWS CloudFormation

Run the following command from the root of the `backend` repository:

```bash
aws cloudformation create-stack \
  --stack-name clouddrop-backend-stack \
  --template-body file://infra/cloudformation/clouddrop-infra.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### Monitoring Deployment Progress:
```bash
aws cloudformation describe-stack-events \
  --stack-name clouddrop-backend-stack \
  --region us-east-1 \
  --query "StackEvents[?ResourceStatus=='CREATE_IN_PROGRESS' || ResourceStatus=='CREATE_COMPLETE'].[LogicalResourceId, ResourceStatus]" \
  --output table
```

Stack creation typically takes **3 to 4 minutes**.

---

## 3. Retrieve Live Outputs & NLB DNS Name

Once the status reaches `CREATE_COMPLETE`, query the stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name clouddrop-backend-stack \
  --region us-east-1 \
  --query "Stacks[0].Outputs" \
  --output table
```

You will receive outputs similar to:

| OutputKey | OutputValue | Description |
| :--- | :--- | :--- |
| **NLBDnsName** | `clouddrop-demo-nlb-123456789.elb.us-east-1.amazonaws.com` | Public entry point via NLB |
| **SwaggerDocsUrl** | `http://<NLBDnsName>/api/docs` | Live Swagger OpenAPI Documentation |
| **HealthCheckUrl** | `http://<NLBDnsName>/health` | NLB Health Check endpoint |
| **S3BucketName** | `clouddrop-demo-storage-<account>-us-east-1` | S3 Storage Bucket |
| **DynamoDBTableName**| `clouddrop-demo-files` | DynamoDB Metadata Table |

---

## 4. Verifying Apache Reverse Proxy & Backend Health

### Verify Health Endpoint
```bash
curl -i http://<NLBDnsName>/health
```
Response:
```json
HTTP/1.1 200 OK
Server: Apache/2.4.58 (Amazon Linux)
Content-Type: application/json; charset=utf-8

{
  "status": "UP",
  "service": "clouddrop-backend",
  "timestamp": "2026-11-11T06:00:00.000Z"
}
```
*Notice `Server: Apache` confirming that traffic was routed through the Apache reverse proxy!*

### Verify Swagger Documentation
Open your browser and navigate to:
```
http://<NLBDnsName>/api/docs
```
You will see the interactive Swagger UI documenting all endpoints.

---

## 5. Testing the End-to-End Workflow via API

### Step 1: Request S3 Pre-Signed Upload URL
```bash
curl -X POST http://<NLBDnsName>/api/files/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "demo-report.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 2048576,
    "expiryHours": 24,
    "tags": ["demo", "aws"]
  }'
```
Response returns `{ fileId, uploadUrl, s3Key, expiresAt }`.

### Step 2: Upload File Directly to S3
```bash
curl -X PUT "<UPLOAD_URL_RETURNED_FROM_STEP_1>" \
  -H "Content-Type: application/pdf" \
  --data-binary "@test-file.pdf"
```

### Step 3: Verify Lambda Trigger in CloudWatch
1. Open AWS Console -> **CloudWatch** -> **Log groups**.
2. Find `/aws/lambda/clouddrop-demo-file-processor`.
3. Verify that the event was processed, and DynamoDB status was updated to `READY`.

### Step 4: Generate Pre-Signed Download URL
```bash
curl http://<NLBDnsName>/api/files/<FILE_ID>/download-url
```
Response returns `{ fileId, downloadUrl, downloadCount: 1 }`.

---

## 6. Demonstrating Auto Scaling Group (ASG) Self-Healing

1. Go to **EC2 Console** -> **Instances**.
2. Select the instance launched by `clouddrop-demo-asg`.
3. Click **Instance State** -> **Terminate Instance**.
4. Within 60 seconds:
   - NLB marks the instance unhealthy.
   - ASG detects the termination.
   - ASG automatically spins up a new EC2 instance using the Launch Template and User-Data script!
