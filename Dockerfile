# ---------- Build stage ----------
FROM node:20-slim AS builder
WORKDIR /app
ARG APP_VERSION=0.0.0
ARG APP_BUILD_ID=
ARG FORCE_REFRESH=true
ARG RELEASE_TITLE=版本更新说明
ARG RELEASE_NOTES=自动发布

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm install

COPY . .

RUN npx --yes max setup || npx --yes umi setup || true

ENV UMI_ENV=production
ENV API_BASE=http://api.welax-tech.com
ENV APP_VERSION=${APP_VERSION}
ENV APP_BUILD_ID=${APP_BUILD_ID}
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 每次构建都确保生成唯一 buildId，并先写入 version-manifest 再构建
RUN BUILD_ID="${APP_BUILD_ID}" && \
  if [ -z "$BUILD_ID" ]; then BUILD_ID="prod-$(date +%Y%m%d%H%M%S)"; fi && \
  node scripts/update-version-manifest.mjs \
    --version="${APP_VERSION}" \
    --buildId="${BUILD_ID}" \
    --forceRefresh="${FORCE_REFRESH}" \
    --title="${RELEASE_TITLE}" \
    --notes="${RELEASE_NOTES}" && \
  APP_BUILD_ID="${BUILD_ID}" APP_VERSION="${APP_VERSION}" npm run build:prod || ( \
  echo "======== UMI LOG START ========" && \
  (cat /app/node_modules/.cache/logger/umi.log || true) && \
  echo "======== UMI LOG END ========" && \
  exit 1 )

# ---------- Runtime stage ----------
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
