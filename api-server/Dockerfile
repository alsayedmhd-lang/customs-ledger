FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY api-server/package.json ./api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm --filter @workspace/api-server build

WORKDIR /app/api-server

CMD ["pnpm", "start"]
