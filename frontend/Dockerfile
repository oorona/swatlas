# syntax=docker/dockerfile:1
# swatlas frontend: Next.js standalone on Node 24 Alpine. The artifact bundle is
# prepared offline (scripts/build_bundle.sh) and copied in read-only; no model,
# download, or training runs in this image.
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS base
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_ARTICLE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_ARTICLE_URL=${NEXT_PUBLIC_ARTICLE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN test -f public/bundles/index.json || (echo "missing artifact bundle: run scripts/build_bundle.sh" && exit 1)
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=root:root /app/.next/standalone ./
COPY --from=builder --chown=root:root /app/.next/static ./.next/static
COPY --from=builder --chown=root:root /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
