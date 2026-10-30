FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 PILOT_DEPLOYMENT=1
COPY --from=builder --chown=node:node /app/.next/standalone ./.next/standalone
COPY --chown=node:node scripts/start-pilot.mjs ./scripts/start-pilot.mjs
COPY --chown=node:node src/lib/deployment/pilot-environment.mjs ./src/lib/deployment/pilot-environment.mjs
USER node
EXPOSE 3000
CMD ["node", "scripts/start-pilot.mjs"]
