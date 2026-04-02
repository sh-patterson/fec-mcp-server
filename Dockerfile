FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY resources ./resources
COPY README.md LICENSE ./

RUN npm run build \
  && npm prune --omit=dev \
  && chmod +x build/index.js

ENV NODE_ENV=production

ENTRYPOINT ["node", "build/index.js"]
