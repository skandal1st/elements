FROM node:20-alpine AS builder

WORKDIR /app

# Установка зависимостей для sharp и других native modules
RUN apk add --no-cache python3 make g++ vips-dev

COPY package.json package-lock.json* ./

# Устанавливаем ВСЕ зависимости (включая devDependencies для сборки)
RUN npm ci

COPY . .

# Сборка TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache vips-dev

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Копируем собранный код из builder
COPY --from=builder /app/dist ./dist

# Создаём директорию для загрузок
RUN mkdir -p /app/uploads

EXPOSE 3001

CMD ["node", "dist/index.js"]
