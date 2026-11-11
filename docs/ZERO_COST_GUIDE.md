# CloudDrop Zero-Cost Guarantee & Teardown Guide 💰

This project has been deliberately architected to qualify for the **AWS Free Tier**, allowing complete demonstration without incurring unexpected charges.

---

## 📊 AWS Free Tier Breakdown

| Component | AWS Resource | Free Tier Limits | CloudDrop Usage | Charge |
| :--- | :--- | :--- | :--- | :--- |
| **Compute** | EC2 (`t2.micro` or `t3.micro`) | 750 hours/month | 1 instance running in ASG | **$0.00** |
| **Storage** | EBS (`gp3`) | 30 GB/month | 8 GB root volume | **$0.00** |
| **Object Store** | S3 Standard | 5 GB storage, 20,000 GETs, 2,000 PUTs | Demo uploads (< 100 MB) | **$0.00** |
| **Database** | DynamoDB | 25 GB storage, 25 WCU, 25 RCU | On-Demand metadata | **$0.00** |
| **Serverless** | AWS Lambda | 1,000,000 requests/month | S3 Event Trigger | **$0.00** |
| **Networking** | Network Load Balancer (NLB) | Free trial / minimal demo hours | Single NLB active during demo | **$0.00** (when deleted after demo) |

---

## 🛑 Complete Teardown in 1 Command

When your demo, presentation, or interview is finished, run the automated teardown script:

```bash
chmod +x infra/scripts/teardown.sh
./infra/scripts/teardown.sh clouddrop-backend-stack us-east-1
```

### What this script does:
1. **Empties the S3 bucket**: CloudFormation cannot delete an S3 bucket with files in it. The script purges all objects first.
2. **Deletes the CloudFormation stack**: Terminates the EC2 instances, destroys the ASG, deletes the NLB, removes the DynamoDB table, deletes the Lambda function, and removes the IAM roles.
3. Leaves **zero lingering resources** in your AWS account!

