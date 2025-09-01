FROM node:20-alpine AS base
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml ./


FROM base AS dependencies
RUN npm install -g pnpm

RUN pnpm config set network-timeout 600000
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate

FROM dependencies AS build
COPY . .
RUN pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
RUN npm install -g pnpm

COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=dependencies /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 3000

CMD [ "node", "dist/main.js" ]
