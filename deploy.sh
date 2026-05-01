#!/bin/bash
set -euo pipefail

REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
PROJECT="agentcore-browser-demo"

echo "============================================"
echo "Deploying ${PROJECT} (AWS CLI)"
echo "Account: ${ACCOUNT_ID}  Region: ${REGION}"
echo "============================================"

# ---------------------------------------------------------------------------
# 1. ECR — build & push Docker image
# ---------------------------------------------------------------------------
echo ""
echo ">>> 1. ECR: build & push"

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT}"
aws ecr describe-repositories --repository-names "${PROJECT}" --region "${REGION}" >/dev/null 2>&1 || \
  aws ecr create-repository --repository-name "${PROJECT}" --region "${REGION}" --image-scanning-configuration scanOnPush=true >/dev/null

aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com" 2>/dev/null

docker build -t "${PROJECT}:latest" . --quiet
docker tag "${PROJECT}:latest" "${ECR_URI}:latest"
docker push "${ECR_URI}:latest" --quiet
echo "✅ Image: ${ECR_URI}:latest"

# ---------------------------------------------------------------------------
# 2. Build frontend
# ---------------------------------------------------------------------------
echo ""
echo ">>> 2. Build frontend"
npm run build --silent
echo "✅ dist/ ready"

# ---------------------------------------------------------------------------
# 3. VPC + Subnets
# ---------------------------------------------------------------------------
echo ""
echo ">>> 3. VPC + networking"

VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=${PROJECT}-vpc" --query "Vpcs[0].VpcId" --output text --region "${REGION}" 2>/dev/null)
if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
  VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query "Vpc.VpcId" --output text --region "${REGION}")
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support --region "${REGION}"
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames --region "${REGION}"
  aws ec2 create-tags --resources "$VPC_ID" --tags "Key=Name,Value=${PROJECT}-vpc" --region "${REGION}"
  echo "  Created VPC: ${VPC_ID}"
else
  echo "  VPC exists: ${VPC_ID}"
fi

# Internet Gateway
IGW_ID=$(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=${VPC_ID}" --query "InternetGateways[0].InternetGatewayId" --output text --region "${REGION}" 2>/dev/null)
if [ "$IGW_ID" = "None" ] || [ -z "$IGW_ID" ]; then
  IGW_ID=$(aws ec2 create-internet-gateway --query "InternetGateway.InternetGatewayId" --output text --region "${REGION}")
  aws ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" --region "${REGION}"
  aws ec2 create-tags --resources "$IGW_ID" --tags "Key=Name,Value=${PROJECT}-igw" --region "${REGION}"
fi

# Subnets (2 AZs)
AZ1=$(aws ec2 describe-availability-zones --region "${REGION}" --query "AvailabilityZones[0].ZoneName" --output text)
AZ2=$(aws ec2 describe-availability-zones --region "${REGION}" --query "AvailabilityZones[1].ZoneName" --output text)

SUBNET1_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" "Name=cidr-block,Values=10.0.1.0/24" --query "Subnets[0].SubnetId" --output text --region "${REGION}" 2>/dev/null)
if [ "$SUBNET1_ID" = "None" ] || [ -z "$SUBNET1_ID" ]; then
  SUBNET1_ID=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 10.0.1.0/24 --availability-zone "$AZ1" --query "Subnet.SubnetId" --output text --region "${REGION}")
  aws ec2 modify-subnet-attribute --subnet-id "$SUBNET1_ID" --map-public-ip-on-launch --region "${REGION}"
fi

SUBNET2_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" "Name=cidr-block,Values=10.0.2.0/24" --query "Subnets[0].SubnetId" --output text --region "${REGION}" 2>/dev/null)
if [ "$SUBNET2_ID" = "None" ] || [ -z "$SUBNET2_ID" ]; then
  SUBNET2_ID=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 10.0.2.0/24 --availability-zone "$AZ2" --query "Subnet.SubnetId" --output text --region "${REGION}")
  aws ec2 modify-subnet-attribute --subnet-id "$SUBNET2_ID" --map-public-ip-on-launch --region "${REGION}"
fi

# Route table
RT_ID=$(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=${VPC_ID}" "Name=tag:Name,Values=${PROJECT}-rt" --query "RouteTables[0].RouteTableId" --output text --region "${REGION}" 2>/dev/null)
if [ "$RT_ID" = "None" ] || [ -z "$RT_ID" ]; then
  RT_ID=$(aws ec2 create-route-table --vpc-id "$VPC_ID" --query "RouteTable.RouteTableId" --output text --region "${REGION}")
  aws ec2 create-tags --resources "$RT_ID" --tags "Key=Name,Value=${PROJECT}-rt" --region "${REGION}"
  aws ec2 create-route --route-table-id "$RT_ID" --destination-cidr-block 0.0.0.0/0 --gateway-id "$IGW_ID" --region "${REGION}" >/dev/null
  aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$SUBNET1_ID" --region "${REGION}" >/dev/null
  aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$SUBNET2_ID" --region "${REGION}" >/dev/null
fi

echo "  VPC=${VPC_ID} Subnets=${SUBNET1_ID},${SUBNET2_ID}"

# ---------------------------------------------------------------------------
# 4. Security Groups
# ---------------------------------------------------------------------------
echo ""
echo ">>> 4. Security groups"

ALB_SG=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=${VPC_ID}" "Name=group-name,Values=${PROJECT}-alb-sg" --query "SecurityGroups[0].GroupId" --output text --region "${REGION}" 2>/dev/null)
if [ "$ALB_SG" = "None" ] || [ -z "$ALB_SG" ]; then
  ALB_SG=$(aws ec2 create-security-group --group-name "${PROJECT}-alb-sg" --description "ALB SG" --vpc-id "$VPC_ID" --query "GroupId" --output text --region "${REGION}")
  aws ec2 authorize-security-group-ingress --group-id "$ALB_SG" --protocol tcp --port 80 --cidr 0.0.0.0/0 --region "${REGION}" >/dev/null
fi

ECS_SG=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=${VPC_ID}" "Name=group-name,Values=${PROJECT}-ecs-sg" --query "SecurityGroups[0].GroupId" --output text --region "${REGION}" 2>/dev/null)
if [ "$ECS_SG" = "None" ] || [ -z "$ECS_SG" ]; then
  ECS_SG=$(aws ec2 create-security-group --group-name "${PROJECT}-ecs-sg" --description "ECS SG" --vpc-id "$VPC_ID" --query "GroupId" --output text --region "${REGION}")
  aws ec2 authorize-security-group-ingress --group-id "$ECS_SG" --protocol tcp --port 3001 --source-group "$ALB_SG" --region "${REGION}" >/dev/null
fi

echo "  ALB_SG=${ALB_SG} ECS_SG=${ECS_SG}"

# ---------------------------------------------------------------------------
# 5. ALB + Target Group
# ---------------------------------------------------------------------------
echo ""
echo ">>> 5. ALB + target group"

ALB_ARN=$(aws elbv2 describe-load-balancers --names "${PROJECT}-alb" --query "LoadBalancers[0].LoadBalancerArn" --output text --region "${REGION}" 2>/dev/null || echo "None")
if [ "$ALB_ARN" = "None" ] || [ -z "$ALB_ARN" ]; then
  ALB_ARN=$(aws elbv2 create-load-balancer --name "${PROJECT}-alb" --subnets "$SUBNET1_ID" "$SUBNET2_ID" --security-groups "$ALB_SG" --scheme internet-facing --type application --query "LoadBalancers[0].LoadBalancerArn" --output text --region "${REGION}")
  echo "  Created ALB"
fi
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query "LoadBalancers[0].DNSName" --output text --region "${REGION}")

TG_ARN=$(aws elbv2 describe-target-groups --names "${PROJECT}-tg" --query "TargetGroups[0].TargetGroupArn" --output text --region "${REGION}" 2>/dev/null || echo "None")
if [ "$TG_ARN" = "None" ] || [ -z "$TG_ARN" ]; then
  TG_ARN=$(aws elbv2 create-target-group --name "${PROJECT}-tg" --protocol HTTP --port 3001 --vpc-id "$VPC_ID" --target-type ip --health-check-path /api/health --health-check-interval-seconds 30 --healthy-threshold-count 2 --query "TargetGroups[0].TargetGroupArn" --output text --region "${REGION}")
fi

# Listener
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query "Listeners[0].ListenerArn" --output text --region "${REGION}" 2>/dev/null || echo "None")
if [ "$LISTENER_ARN" = "None" ] || [ -z "$LISTENER_ARN" ]; then
  LISTENER_ARN=$(aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" --protocol HTTP --port 80 --default-actions "Type=forward,TargetGroupArn=${TG_ARN}" --query "Listeners[0].ListenerArn" --output text --region "${REGION}")
fi

echo "  ALB_DNS=${ALB_DNS}"

# ---------------------------------------------------------------------------
# 6. IAM Roles for ECS
# ---------------------------------------------------------------------------
echo ""
echo ">>> 6. IAM roles"

# Task execution role
EXEC_ROLE_ARN=$(aws iam get-role --role-name "${PROJECT}-ecs-exec" --query "Role.Arn" --output text 2>/dev/null || echo "None")
if [ "$EXEC_ROLE_ARN" = "None" ] || [ -z "$EXEC_ROLE_ARN" ]; then
  EXEC_ROLE_ARN=$(aws iam create-role --role-name "${PROJECT}-ecs-exec" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    --query "Role.Arn" --output text)
  aws iam attach-role-policy --role-name "${PROJECT}-ecs-exec" --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
fi

# Task role (needs AgentCore + Bedrock access)
TASK_ROLE_ARN=$(aws iam get-role --role-name "${PROJECT}-ecs-task" --query "Role.Arn" --output text 2>/dev/null || echo "None")
if [ "$TASK_ROLE_ARN" = "None" ] || [ -z "$TASK_ROLE_ARN" ]; then
  TASK_ROLE_ARN=$(aws iam create-role --role-name "${PROJECT}-ecs-task" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    --query "Role.Arn" --output text)
  aws iam put-role-policy --role-name "${PROJECT}-ecs-task" --policy-name AgentCoreAccess \
    --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["bedrock-agentcore:*","bedrock:*"],"Resource":"*"}]}'
fi

echo "  Exec=${EXEC_ROLE_ARN}"
echo "  Task=${TASK_ROLE_ARN}"

# ---------------------------------------------------------------------------
# 7. ECS Cluster + Task Definition + Service
# ---------------------------------------------------------------------------
echo ""
echo ">>> 7. ECS cluster + service"

# CloudWatch log group
aws logs create-log-group --log-group-name "/ecs/${PROJECT}" --region "${REGION}" 2>/dev/null || true

# Cluster
aws ecs describe-clusters --clusters "${PROJECT}" --region "${REGION}" --query "clusters[?status=='ACTIVE'].clusterName" --output text | grep -q "${PROJECT}" 2>/dev/null || \
  aws ecs create-cluster --cluster-name "${PROJECT}" --region "${REGION}" >/dev/null

# Task definition
cat > /tmp/task-def.json <<EOF
{
  "family": "${PROJECT}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "runtimePlatform": {
    "cpuArchitecture": "ARM64",
    "operatingSystemFamily": "LINUX"
  },
  "executionRoleArn": "${EXEC_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [{
    "name": "api",
    "image": "${ECR_URI}:latest",
    "portMappings": [{"containerPort": 3001, "protocol": "tcp"}],
    "environment": [
      {"name": "AGENT_MODE", "value": "runtime"},
      {"name": "AWS_REGION", "value": "${REGION}"},
      {"name": "NODE_ENV", "value": "production"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/${PROJECT}",
        "awslogs-region": "${REGION}",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
EOF
TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file:///tmp/task-def.json --query "taskDefinition.taskDefinitionArn" --output text --region "${REGION}")
echo "  TaskDef: ${TASK_DEF_ARN}"

# Service (create or update)
SVC_STATUS=$(aws ecs describe-services --cluster "${PROJECT}" --services "${PROJECT}-svc" --region "${REGION}" --query "services[0].status" --output text 2>/dev/null || echo "None")
if [ "$SVC_STATUS" = "ACTIVE" ]; then
  aws ecs update-service --cluster "${PROJECT}" --service "${PROJECT}-svc" --task-definition "$TASK_DEF_ARN" --force-new-deployment --region "${REGION}" >/dev/null
  echo "  Updated service"
else
  aws ecs create-service --cluster "${PROJECT}" --service-name "${PROJECT}-svc" \
    --task-definition "$TASK_DEF_ARN" --desired-count 1 --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNET1_ID},${SUBNET2_ID}],securityGroups=[${ECS_SG}],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=${TG_ARN},containerName=api,containerPort=3001" \
    --region "${REGION}" >/dev/null
  echo "  Created service"
fi

# ---------------------------------------------------------------------------
# 8. S3 Bucket (private, no public access)
# ---------------------------------------------------------------------------
echo ""
echo ">>> 8. S3 bucket (private)"

BUCKET="${PROJECT}-frontend-${ACCOUNT_ID}"
aws s3api head-bucket --bucket "$BUCKET" --region "${REGION}" 2>/dev/null || \
  aws s3api create-bucket --bucket "$BUCKET" --region "${REGION}" >/dev/null

aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" --region "${REGION}"

echo "  Bucket: ${BUCKET} (all public access blocked)"

# ---------------------------------------------------------------------------
# 9. CloudFront + OAC
# ---------------------------------------------------------------------------
echo ""
echo ">>> 9. CloudFront distribution"

# OAC
OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='${PROJECT}-oac'].Id" --output text 2>/dev/null)
if [ -z "$OAC_ID" ] || [ "$OAC_ID" = "None" ]; then
  OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config \
    "{\"Name\":\"${PROJECT}-oac\",\"SigningProtocol\":\"sigv4\",\"SigningBehavior\":\"always\",\"OriginAccessControlOriginType\":\"s3\"}" \
    --query "OriginAccessControl.Id" --output text)
  echo "  Created OAC: ${OAC_ID}"
fi

# Check for existing distribution
CF_DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='${PROJECT}'].Id" --output text 2>/dev/null)

S3_DOMAIN="${BUCKET}.s3.${REGION}.amazonaws.com"

cat > /tmp/cf-config.json <<CFEOF
{
  "CallerReference": "${PROJECT}-$(date +%s)",
  "Comment": "${PROJECT}",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "S3Origin",
        "DomainName": "${S3_DOMAIN}",
        "OriginAccessControlId": "${OAC_ID}",
        "S3OriginConfig": {"OriginAccessIdentity": ""}
      },
      {
        "Id": "ALBOrigin",
        "DomainName": "${ALB_DNS}",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only",
          "OriginReadTimeout": 60,
          "OriginKeepaliveTimeout": 60,
          "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]}
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3Origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"], "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "ALBOrigin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {"Quantity": 7, "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"], "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}},
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
        "Compress": true
      }
    ]
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {"ErrorCode": 403, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0},
      {"ErrorCode": 404, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0}
    ]
  }
}
CFEOF

if [ -z "$CF_DIST_ID" ] || [ "$CF_DIST_ID" = "None" ]; then
  CF_DIST_ID=$(aws cloudfront create-distribution --distribution-config file:///tmp/cf-config.json --query "Distribution.Id" --output text)
  echo "  Created distribution: ${CF_DIST_ID}"
else
  echo "  Distribution exists: ${CF_DIST_ID}"
fi

CF_DOMAIN=$(aws cloudfront get-distribution --id "$CF_DIST_ID" --query "Distribution.DomainName" --output text)

# S3 bucket policy — allow only CloudFront OAC
cat > /tmp/bucket-policy.json <<BPEOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET}/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${CF_DIST_ID}"
      }
    }
  }]
}
BPEOF
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/bucket-policy.json
echo "  Bucket policy: CloudFront OAC only"

# ---------------------------------------------------------------------------
# 10. Upload frontend to S3
# ---------------------------------------------------------------------------
echo ""
echo ">>> 10. Upload frontend"

# Copy DCV viewer assets too
cp -r public/nice-dcv-web-client-sdk dist/ 2>/dev/null || true
cp public/dcv-viewer.html dist/ 2>/dev/null || true
cp public/favicon.svg dist/ 2>/dev/null || true

aws s3 sync dist/ "s3://${BUCKET}" --delete --region "${REGION}" --quiet
echo "  ✅ Uploaded to s3://${BUCKET}"

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id "$CF_DIST_ID" --paths "/*" >/dev/null 2>&1 || true
echo "  ✅ Cache invalidated"

# ---------------------------------------------------------------------------
# 11. Wait for ECS service to stabilize
# ---------------------------------------------------------------------------
echo ""
echo ">>> 11. Waiting for ECS service..."
aws ecs wait services-stable --cluster "${PROJECT}" --services "${PROJECT}-svc" --region "${REGION}" 2>/dev/null || echo "  (timeout — service may still be starting)"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "🚀 Deployment complete!"
echo "============================================"
echo ""
echo "Frontend:  https://${CF_DOMAIN}"
echo "API (ALB): http://${ALB_DNS}"
echo "S3 Bucket: ${BUCKET} (private — CloudFront OAC only)"
echo ""
echo "CloudFront may take 5-10 min to fully deploy."
echo "DCV live view will work because the browser"
echo "connects directly to AWS — no proxy in the way."
echo ""
