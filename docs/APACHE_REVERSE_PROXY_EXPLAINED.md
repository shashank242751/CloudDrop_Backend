# Apache Reverse Proxy, NLB, and ASG Explained 🛡️🔌

This document explains the exact mechanics of how **Apache HTTP Server**, the **Network Load Balancer (NLB)**, and the **Auto Scaling Group (ASG)** cooperate in the CloudDrop backend to hide internal application ports and provide enterprise-grade reliability.

---

## 1. The Core Problem: Why Not Expose NestJS (Port 3000) Directly?

When you start NestJS inside a Docker container, it listens on port `3000` (`http://0.0.0.0:3000`).

In production, exposing Node.js directly to the public internet on port 3000 is considered bad practice for several reasons:

| Issue | Why Exposing Node.js Directly is Risky | How Apache Reverse Proxy Solves It |
| :--- | :--- | :--- |
| **Port Clutter** | Users/browsers must type `http://domain.com:3000` instead of standard `http://domain.com`. | Apache listens on standard port **80** and proxies internally. |
| **Security & Privileges** | Running Node.js as root on port 80 exposes your runtime process to privilege escalation. | Apache binds to port 80 as a hardened system daemon; Node.js runs as an unprivileged user inside a Docker container on port 3000. |
| **Connection Buffering** | Slow client uploads/downloads tie up Node.js event-loop workers. | Apache buffers slow client connections, shielding Node.js workers. |
| **Standardized Logging** | Application logs get mixed with raw HTTP access/error logs. | Apache logs standard access/error formats in `/var/log/httpd/` independently of application logs. |

---

## 2. Apache Configuration (`clouddrop.conf`)

Inside `/etc/httpd/conf.d/clouddrop.conf` on the EC2 instance:

```apache
<VirtualHost *:80>
    ServerName _

    # Preserve the original Host header sent by the client
    ProxyPreserveHost On
    ProxyRequests Off

    # Route NLB and Auto Scaling health checks
    ProxyPass /health http://127.0.0.1:3000/health
    ProxyPassReverse /health http://127.0.0.1:3000/health

    # Route Swagger OpenAPI Documentation
    ProxyPass /api/docs http://127.0.0.1:3000/api/docs
    ProxyPassReverse /api/docs http://127.0.0.1:3000/api/docs

    # Route all API calls to NestJS container
    ProxyPass /api http://127.0.0.1:3000/api
    ProxyPassReverse /api http://127.0.0.1:3000/api

    # Default fallback
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    # Access and Error Logs
    ErrorLog /var/log/httpd/clouddrop_error.log
    CustomLog /var/log/httpd/clouddrop_access.log combined
</VirtualHost>
```

### What `ProxyPass` and `ProxyPassReverse` Do:
- **`ProxyPass /api http://127.0.0.1:3000/api`**: Tells Apache that whenever an incoming request starts with `/api`, forward the raw HTTP bytes locally across loopback to port 3000.
- **`ProxyPassReverse`**: Rewrites any HTTP redirect headers (`Location`) sent back by NestJS so the client's browser never discovers the internal `http://127.0.0.1:3000` address.

---

## 3. Apache vs. ASG vs. NLB: Distinct Responsibilities

Students and engineers frequently confuse these three components. Here is their clear separation of duties:

```
+-----------------------------------------------------------------------------------------+
|                                    AWS Cloud VPC                                        |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   | 1. Network Load Balancer (NLB)                                                  |   |
|   |    - Role: High-throughput Layer 4 TCP traffic distributor                      |   |
|   |    - Public entry point across Availability Zones (Subnet 1 & 2)                |   |
|   |    - Monitors Target Group health (/health on port 80)                          |   |
|   +---------------------------------------+-----------------------------------------+   |
|                                           | Forward Port 80                             |
|                                           v                                             |
|   +---------------------------------------------------------------------------------+   |
|   | 2. Auto Scaling Group (ASG)                                                     |   |
|   |    - Role: Fleet Manager & Self-Healing                                         |   |
|   |    - Ensures desired EC2 instance count (1 to 2)                                |   |
|   |    - Terminates and replaces EC2 instances that fail ELB health checks         |   |
|   +---------------------------------------+-----------------------------------------+   |
|                                           | Provisions & Monitors                       |
|                                           v                                             |
|   +---------------------------------------------------------------------------------+   |
|   | 3. EC2 Instance Host Operating System                                            |   |
|   |                                                                                 |   |
|   |    +-----------------------------------------------------------------------+    |   |
|   |    | Apache Server (httpd) - Listens on Port 80                            |    |   |
|   |    |   - Role: Reverse Proxy & Port Hider                                  |    |   |
|   |    |   - Receives Port 80 from NLB                                         |    |   |
|   |    |   - Forwards to 127.0.0.1:3000                                        |    |   |
|   |    +----------------------------------+------------------------------------+    |   |
|   |                                       | Local Loopback (127.0.0.1:3000)             |
|   |                                       v                                             |
|   |    +-----------------------------------------------------------------------+    |   |
|   |    | Docker Container (NestJS) - Listens on Port 3000                      |    |   |
|   |    |   - Role: Core Application Logic & AWS SDK Client                     |    |   |
|   |    |   - Communicates with DynamoDB & S3                                   |    |   |
|   |    +-----------------------------------------------------------------------+    |   |
|   +---------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

---

## 4. End-to-End Request Life Cycle

1. **Client / Browser**:
   Sends `GET http://clouddrop-demo-nlb-123.elb.us-east-1.amazonaws.com/api/files` on port `80`.
2. **Network Load Balancer (NLB)**:
   Receives the TCP packet on port 80. Checks target health and forwards to an EC2 instance in Public Subnet 1 on port 80.
3. **Apache Server (on EC2)**:
   Listens on port 80. Evaluates virtual host rules in `clouddrop.conf`. Matches rule `ProxyPass /api http://127.0.0.1:3000/api`.
4. **NestJS Docker Container**:
   Receives the request on `127.0.0.1:3000/api/files`. Queries the DynamoDB table `clouddrop-demo-files` using the EC2 IAM Instance Profile.
5. **Response Return Path**:
   NestJS sends JSON back to Apache -> Apache sends response back through NLB -> NLB returns response to the Client browser.
   **At no point did the client ever see or touch port 3000!**

