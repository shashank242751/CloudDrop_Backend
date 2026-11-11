# CloudDrop Swagger OpenAPI Specification 📑

The CloudDrop backend integrates `@nestjs/swagger` and `swagger-ui-express`. When the backend runs (locally on port 3000, or via NLB on port 80), Swagger UI is served at:

```
http://<HOST>/api/docs
```

---

## 📌 Available Endpoints

### 1. File Upload & Pre-signed URL Session
- **Endpoint**: `POST /api/files/upload-url`
- **Description**: Generates a pre-signed S3 PUT URL and creates a DynamoDB record with status `PENDING`.
- **Request Body**:
```json
{
  "fileName": "project-plan.docx",
  "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "sizeBytes": 1048576,
  "expiryHours": 24,
  "tags": ["project", "q4"]
}
```
- **Response `201 Created`**:
```json
{
  "fileId": "6b360b9d-5bc3-4876-8051-409bdf5359a1",
  "s3Key": "uploads/6b360b9d-5bc3-4876-8051-409bdf5359a1/project-plan.docx",
  "uploadUrl": "https://clouddrop-demo-storage-...s3.amazonaws.com/uploads/...?X-Amz-Signature=...",
  "expiresAt": "2026-11-12T06:00:00.000Z"
}
```

---

### 2. Confirm Upload Completion
- **Endpoint**: `POST /api/files/:fileId/confirm`
- **Description**: Updates file status to `READY` in DynamoDB once client completes the direct S3 PUT.
- **Path Parameter**: `fileId` (UUID)
- **Response `200 OK`**:
```json
{
  "message": "File upload confirmed successfully",
  "fileId": "6b360b9d-5bc3-4876-8051-409bdf5359a1",
  "status": "READY"
}
```

---

### 3. List All Files
- **Endpoint**: `GET /api/files`
- **Description**: Retrieves active file records from DynamoDB.
- **Response `200 OK`**:
```json
[
  {
    "fileId": "6b360b9d-5bc3-4876-8051-409bdf5359a1",
    "originalName": "project-plan.docx",
    "s3Key": "uploads/6b360b9d-5bc3-4876-8051-409bdf5359a1/project-plan.docx",
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "sizeBytes": 1048576,
    "status": "READY",
    "downloadCount": 3,
    "uploadedAt": "2026-11-11T06:00:00.000Z",
    "expiresAt": 1794376800,
    "tags": ["project", "q4"],
    "processedMetadata": {
      "md5Checksum": "c1f7a08b981",
      "lambdaProcessedAt": "2026-11-11T06:00:05.000Z"
    }
  }
]
```

---

### 4. Generate Pre-signed Download URL
- **Endpoint**: `GET /api/files/:fileId/download-url`
- **Description**: Increments the file's `downloadCount` in DynamoDB and returns a secure, time-limited S3 GET URL.
- **Response `200 OK`**:
```json
{
  "fileId": "6b360b9d-5bc3-4876-8051-409bdf5359a1",
  "originalName": "project-plan.docx",
  "downloadUrl": "https://clouddrop-demo-storage-...s3.amazonaws.com/uploads/...?X-Amz-Signature=...",
  "downloadCount": 4,
  "expiresInSeconds": 300
}
```

---

### 5. Delete File
- **Endpoint**: `DELETE /api/files/:fileId`
- **Description**: Deletes the object from Amazon S3 and removes its metadata record from DynamoDB.
- **Response `200 OK`**:
```json
{
  "message": "File project-plan.docx (6b360b9d...) deleted successfully"
}
```

---

### 6. Health Checks (for NLB & ASG)
- **Endpoint**: `GET /health` and `GET /api/health`
- **Response `200 OK`**:
```json
{
  "status": "UP",
  "service": "clouddrop-backend",
  "timestamp": "2026-11-11T06:00:00.000Z"
}
```
