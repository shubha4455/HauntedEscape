FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    DB_PATH=/data/haunted-escape.sqlite

WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js ./

USER node
EXPOSE 3001
CMD ["npm", "start"]
