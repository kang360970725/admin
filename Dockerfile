# ---------- Build stage ----------
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm install

COPY . .

RUN npx --yes max setup || npx --yes umi setup || true

ENV UMI_ENV=production
ENV API_BASE=http://api.welax-tech.com
ENV NODE_OPTIONS="--max-old-space-size=4096"

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
