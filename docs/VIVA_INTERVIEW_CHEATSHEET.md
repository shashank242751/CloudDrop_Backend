# CloudDrop Backend Viva & Interview Cheat Sheet 🎯

Use this document to prepare for technical interviews, viva defenses, or project presentations covering AWS, Docker, Swagger, and system architecture.

---

### Q1: Why did you choose a Network Load Balancer (NLB) instead of an Application Load Balancer (ALB)?
> **Answer**:
> - An NLB operates at **Layer 4 (Transport Layer - TCP)**, while an ALB operates at Layer 7 (HTTP/HTTPS).
> - NLBs are designed to handle millions of requests per second with **ultra-low, sub-millisecond latency** and can effortlessly absorb sudden traffic spikes without requiring pre-warming.
> - NLBs provide static IP addresses per Availability Zone and pass raw TCP packets directly to the backend EC2 instances, where the Apache reverse proxy handles HTTP processing.

---

### Q2: What is the purpose of S3 Pre-Signed URLs in this architecture?
> **Answer**:
> - In standard architectures, files are sent from the browser to the backend server, and the backend server uploads them to S3. This consumes massive EC2 network bandwidth, memory, and CPU.
> - With **S3 Pre-Signed URLs**, the backend only generates a small, cryptographically signed token valid for 15 minutes. The client browser streams the multi-GB file **directly into Amazon S3**.
> - This decouples storage throughput from EC2 compute limits, saves server bandwidth, and speeds up transfers.

---

### Q3: Why use Amazon DynamoDB instead of Amazon RDS for this project?
> **Answer**:
> 1. **Serverless & Zero Maintenance**: DynamoDB has no database instances to patch, configure, or manage.
> 2. **Native Time-To-Live (TTL)**: CloudDrop files expire automatically. DynamoDB automatically scans and purges expired records in the background using the `expiresAt` epoch timestamp without needing custom cron jobs or background server tasks.
> 3. **100% Free Tier Eligible**: DynamoDB provides 25 GB of storage and 25 read/write capacity units free forever, whereas RDS instances (even `db.t3.micro`) incur charges after the initial 12-month free tier expires.

---

### Q4: What is the role of the Apache HTTP Server on the EC2 backend?
> **Answer**:
> - Apache acts as a **Reverse Proxy**.
> - It listens on public standard HTTP port **80** and proxies requests locally across the loopback interface (`127.0.0.1:3000`) to the NestJS Docker container.
> - This hides port 3000 from public access, terminates connections safely, and enables separate access and error logging in `/var/log/httpd/`.

---

### Q5: How does the Auto Scaling Group (ASG) achieve self-healing?
> **Answer**:
> - The ASG is coupled with the NLB Target Group using `HealthCheckType: ELB`.
> - The NLB sends periodic HTTP health probes to `http://instance-ip:80/health`.
> - If an EC2 instance crashes or fails health checks, the NLB marks it unhealthy.
> - The Auto Scaling Group automatically terminates the unhealthy instance and provisions a brand-new instance using the **Launch Template** and **User-Data bootstrap script**.

---

### Q6: How does the backend authenticate with AWS S3 and DynamoDB without hardcoding credentials?
> **Answer**:
> - CloudDrop uses an **IAM Instance Profile** attached to the EC2 Launch Template.
> - The AWS SDK v3 in NestJS automatically fetches temporary, rotating security credentials from the EC2 Instance Metadata Service (IMDSv2).
> - There are **zero access keys, secret keys, or passwords stored in the code or on the server filesystem**.

---

### Q7: What is the event-driven trigger for AWS Lambda?
> **Answer**:
> - When a file completes uploading directly to S3 via a pre-signed URL, Amazon S3 generates an `s3:ObjectCreated:Put` event.
> - This event invokes the AWS Lambda function.
> - The Lambda extracts the object's key, size, and MD5 ETag checksum, then directly updates the file's status to `READY` in DynamoDB.

---

### Q8: What does the CloudFormation template provision?
> **Answer**:
> - It provisions the complete infrastructure in one command:
>   - VPC, 2 Public Subnets across 2 Availability Zones, Internet Gateway, and Route Tables.
>   - Security Groups for the NLB and EC2 instances.
>   - S3 Bucket with CORS configuration.
>   - DynamoDB Table with TTL enabled.
>   - IAM Roles for EC2 Instance Profile and Lambda execution.
>   - AWS Lambda function for S3 event processing.
>   - NLB, Listener on Port 80, and Target Group with HTTP health check.
>   - EC2 Launch Template with EBS gp3 volume and User-Data bootstrap.
>   - Auto Scaling Group (Min 1, Max 2, Desired 1).

