FROM node:22-alpine AS base
WORKDIR /app

FROM base AS dependencias
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM dependencias AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM base AS dependencias-producao
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS producao
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --chown=node:node package.json ./
COPY --from=dependencias-producao --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=120s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "node dist/infrastructure/database/scripts/preparar.js; exec node dist/cluster.js"]
