FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV PUBLIC_INSTALL_ORIGIN=same-origin
RUN pnpm build
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/data ./src/data
COPY --from=build /app/src/bot ./src/bot
COPY --from=build /app/src/lib/build-config.mjs /app/src/lib/install-link.mjs ./src/lib/
COPY --from=build /app/worker ./worker
USER node
EXPOSE 3000
CMD ["node", "worker/server.mjs"]
