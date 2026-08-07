# ---------- Build stage ----------
FROM node:20-slim AS builder
WORKDIR /app
ARG APP_VERSION=0.0.0
ARG APP_BUILD_ID=
ARG FORCE_REFRESH=true
ARG RELEASE_TITLE=版本更新说明
ARG RELEASE_NOTES=自动发布
# 新增接口地址入参，支持流水线动态传参切换环境
ARG API_BASE=http://api.welax-tech.com

# 优先拷贝依赖文件，最大化Docker缓存复用，加快构建速度
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm install

# 依赖安装完成后再拷贝全量源码
COPY . .

RUN npx --yes max setup || npx --yes umi setup || true

ENV UMI_ENV=production
ENV API_BASE=${API_BASE}
ENV APP_VERSION=${APP_VERSION}
ENV APP_BUILD_ID=${APP_BUILD_ID}
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 生成唯一buildId、清理umi缓存、更新版本清单、执行生产构建
RUN BUILD_ID="${APP_BUILD_ID}" && \
  if [ -z "$BUILD_ID" ]; then BUILD_ID="prod-$(date +%Y%m%d%H%M%S)"; fi && \
  rm -rf /app/node_modules/.cache && \
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