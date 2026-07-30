# Build from monorepo root so workspace packages resolve.
FROM node:22-bookworm-slim AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web apps/web
COPY packages/workflow-schema packages/workflow-schema
RUN pnpm install --frozen-lockfile=false

ARG NEXT_PUBLIC_API_URL=/backend
ARG NEXT_PUBLIC_COMMUNITY_API_URL=/community-backend
ARG NEXT_PUBLIC_LOCAL_EDITOR_URL=http://localhost:3000
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_SITE_MODE=
ARG API_PROXY_TARGET=http://api:8000
ARG COMMUNITY_API_PROXY_TARGET=http://api:8000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_COMMUNITY_API_URL=$NEXT_PUBLIC_COMMUNITY_API_URL \
    NEXT_PUBLIC_LOCAL_EDITOR_URL=$NEXT_PUBLIC_LOCAL_EDITOR_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_SITE_MODE=$NEXT_PUBLIC_SITE_MODE \
    API_PROXY_TARGET=$API_PROXY_TARGET \
    COMMUNITY_API_PROXY_TARGET=$COMMUNITY_API_PROXY_TARGET

RUN pnpm --filter @operate-ai/workflow-schema run build \
 && pnpm --filter @operate-ai/web build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

COPY --from=builder /repo/apps/web/public ./public
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
