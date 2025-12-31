# ---------- Build stage ----------
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm install

COPY . .

# ✅ Max/Umi v4 常需要 setup（相当于生成临时文件等前置步骤）
RUN npx max setup || npx umi setup || true

ENV UMI_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# ✅ 构建失败时把 umi.log 打出来（否则你永远看不到真正原因）
RUN npm run build:prod || ( \
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
