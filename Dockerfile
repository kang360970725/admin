# ---------- Build stage ----------
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm install

COPY . .

# 你的脚本是 build:prod
ENV UMI_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build:prod

# ---------- Runtime stage ----------
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
