FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json tsconfig.node.json ./
COPY server/ server/
COPY agent/ agent/

FROM node:20-slim
WORKDIR /app

# Install Python for agentcore CLI
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

# Fix agent config source_path for container environment
RUN sed -i 's|source_path:.*|source_path: /app/agent|' /app/agent/.bedrock_agentcore.yaml

# Install agentcore CLI in the container
RUN python3 -m venv /app/agent/.venv && \
    /app/agent/.venv/bin/pip install --no-cache-dir bedrock-agentcore-starter-toolkit

# Install tsx globally for running TypeScript
RUN npm install -g tsx

ENV NODE_ENV=production
ENV PORT=3001
ENV AGENT_MODE=runtime
ENV AWS_REGION=us-east-1
ENV AGENTCORE_BIN=/app/agent/.venv/bin/agentcore
ENV AGENT_DIR=/app/agent

EXPOSE 3001
CMD ["tsx", "server/index.ts"]
