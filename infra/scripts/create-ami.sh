#!/bin/bash
# ==============================================================================
# CloudDrop Custom AMI Creation Script
# Use this script to capture a customized Amazon Machine Image (AMI)
# containing pre-installed Docker, Apache, and required dependencies.
# This enables the Auto Scaling Group (ASG) to boot new instances in under 30s!
# ==============================================================================

set -e

INSTANCE_ID=$1
AMI_NAME="clouddrop-golden-ami-$(date +%Y%m%d-%H%M)"
AWS_REGION=${AWS_REGION:-"us-east-1"}

if [ -z "$INSTANCE_ID" ]; then
    echo "Usage: ./create-ami.sh <instance-id>"
    echo "Example: ./create-ami.sh i-0123456789abcdef0"
    exit 1
fi

echo "Creating custom AMI from instance: $INSTANCE_ID in $AWS_REGION..."

AMI_ID=$(aws ec2 create-image \
    --instance-id "$INSTANCE_ID" \
    --name "$AMI_NAME" \
    --description "Pre-baked AMI with Apache httpd, Docker, and CloudDrop dependencies" \
    --no-reboot \
    --region "$AWS_REGION" \
    --output text \
    --query 'ImageId')

echo "Successfully initiated AMI creation. Image ID: $AMI_ID"
echo "Waiting for AMI to reach 'available' state..."

aws ec2 wait image-available --image-ids "$AMI_ID" --region "$AWS_REGION"

echo "=========================================================="
echo "AMI is READY: $AMI_ID"
echo "Update your CloudFormation or Launch Template ImageId parameter with this AMI ID!"
echo "=========================================================="

