FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma 7 loads prisma.config.ts during generation; no database connection is made here.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build pnpm prisma:generate && \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build pnpm build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts /app/tsconfig.json ./
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
CMD ["pnpm", "start"]
