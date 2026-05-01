#!/bin/bash
set -euo pipefail

# Quick redeploy — skips infra, only rebuilds and pushes code
REGION="us-east-1"
PROJECT="agentcore-browser-demo"
BUCKET="${PROJECT}-frontend-632930644527"
ECR_URI="632930644527.dkr.ecr.${REGION}.amazonaws.com/${PROJECT}"
CF_DIST_ID="E1UVQ387S9T4L1"

TAG="v$(date +%s)"

echo ">>> Build frontend"
npm run build --silent
cp -r public/nice-dcv-web-client-sdk dist/ 2>/dev/null || true
cp public/favicon.svg dist/ 2>/dev/null || true

echo ">>> Upload to S3"
aws s3 sync dist/ "s3://${BUCKET}" --delete --region "${REGION}" --quiet

echo ">>> Build & push Docker (${TAG})"
aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "632930644527.dkr.ecr.${REGION}.amazonaws.com" 2>/dev/null
docker build -t "${PROJECT}:latest" . --quiet
docker tag "${PROJECT}:latest" "${ECR_URI}:${TAG}"
docker push "${ECR_URI}:${TAG}" --quiet

echo ">>> Update ECS"
EXEC_ROLE=$(aws iam get-role --role-name "${PROJECT}-ecs-exec" --query "Role.Arn" --output text)
TASK_ROLE=$(aws iam get-role --role-name "${PROJECT}-ecs-task" --query "Role.Arn" --output text)

cat > /tmp/task-def.json <<EOF
{"family":"${PROJECT}","networkMode":"awsvpc","requiresCompatibilities":["FARGATE"],"cpu":"512","memory":"1024","runtimePlatform":{"cpuArchitecture":"ARM64","operatingSystemFamily":"LINUX"},"executionRoleArn":"${EXEC_ROLE}","taskRoleArn":"${TASK_ROLE}","containerDefinitions":[{"name":"api","image":"${ECR_URI}:${TAG}","portMappings":[{"containerPort":3001,"protocol":"tcp"}],"environment":[{"name":"AGENT_MODE","value":"runtime"},{"name":"AWS_REGION","value":"${REGION}"},{"name":"NODE_ENV","value":"production"}],"logConfiguration":{"logDriver":"awslogs","options":{"awslogs-group":"/ecs/${PROJECT}","awslogs-region":"${REGION}","awslogs-stream-prefix":"ecs"}}}]}
EOF

TD_ARN=$(aws ecs register-task-definition --cli-input-json file:///tmp/task-def.json --query "taskDefinition.taskDefinitionArn" --output text --region "${REGION}")
aws ecs update-service --cluster "${PROJECT}" --service "${PROJECT}-svc" --task-definition "$TD_ARN" --force-new-deployment --region "${REGION}" >/dev/null

echo ">>> Invalidate CloudFront"
aws cloudfront create-invalidation --distribution-id "${CF_DIST_ID}" --paths "/*" >/dev/null

echo ">>> Wait for ECS"
aws ecs wait services-stable --cluster "${PROJECT}" --services "${PROJECT}-svc" --region "${REGION}"

echo ""
echo "✅ Deployed: https://d319md4f6odh3i.cloudfront.net"
