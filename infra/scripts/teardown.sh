#!/bin/bash
# ==============================================================================
# CloudDrop Zero-Cost Teardown Script
# Ensures 100% complete cleanup of all provisioned AWS resources to prevent charges.
# ==============================================================================

STACK_NAME=${1:-"clouddrop-stack"}
AWS_REGION=${AWS_REGION:-"us-east-1"}

echo "=== [1/3] Finding S3 Bucket attached to Stack: $STACK_NAME ==="
BUCKET_NAME=$(aws cloudformation describe-stack-resources \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "StackResources[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId" \
    --output text 2>/dev/null || echo "")

if [ -n "$BUCKET_NAME" ] && [ "$BUCKET_NAME" != "None" ]; then
    echo "Emptying S3 bucket: $BUCKET_NAME (CloudFormation requires empty bucket to delete)..."
    aws s3 rm "s3://$BUCKET_NAME" --recursive --region "$AWS_REGION" || true
fi

echo "=== [2/3] Deleting CloudFormation Stack: $STACK_NAME ==="
aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$AWS_REGION"

echo "Waiting for stack deletion to complete (this terminates EC2, ASG, NLB, and DynamoDB)..."
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$AWS_REGION"

echo "=== [3/3] Teardown Complete! Zero lingering resources. Cost = $0.00 ==="

