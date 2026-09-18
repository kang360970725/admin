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

# 只使用仓库内的 yarn.lock，避免 npm 在每次云端构建时重新解析依赖版本。
# package.json 已声明 Yarn 版本，Corepack 会据此启用一致的包管理器。
COPY package.json yarn.lock ./
RUN corepack enable && \
  yarn install --frozen-lockfile --non-interactive --network-timeout 300000

# 依赖安装完成后再拷贝全量源码
COPY . .

ENV UMI_ENV=production
ENV API_BASE=${API_BASE}
ENV APP_VERSION=${APP_VERSION}
ENV APP_BUILD_ID=${APP_BUILD_ID}
ENV NODE_OPTIONS="--max-old-space-size=4096"

# max build 自身会完成 Umi prepare，无需再执行一次可能访问网络的 npx setup。
# 生成唯一 buildId、更新版本清单、执行生产构建。
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
# 固定运行时版本，避免 stable-alpine 漂移后同一份代码得到不同的容器行为。
FROM nginx:1.28.0-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 将静态产物和 Nginx 配置问题提前到镜像构建阶段暴露，避免部署后才表现为探针拒绝连接。
RUN test -s /usr/share/nginx/html/index.html && nginx -t

EXPOSE 80

# 不依赖基础镜像的 /docker-entrypoint.sh，直接以前台进程启动 Nginx。
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off; error_log /dev/stderr info;"]
