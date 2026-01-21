FROM node:20-alpine

WORKDIR /app

# Установка зависимостей для sharp и других native modules
RUN apk add --no-cache python3 make g++ vips-dev

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY . .

# Сборка TypeScript
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
