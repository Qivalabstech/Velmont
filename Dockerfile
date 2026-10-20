# VELMONT store: production image
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/storage/uploads BACKUP_DIR=/backups
RUN groupadd -r app && useradd -r -m -g app app && mkdir -p /app/storage/uploads /backups
# Full node_modules so the migrate, seed and create-owner scripts can run inside the container.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/db ./src/db
COPY --from=build /app/src/lib/permissions.ts ./src/lib/permissions.ts
COPY --from=build /app/package.json ./package.json
# The app must be able to write its image cache and uploaded photos.
RUN mkdir -p /app/.next/cache && chown -R app:app /app/.next /app/storage
USER app
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=10s --start-period=40s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply database migrations, then start the store. HOSTNAME is set here because Docker
# overwrites it with the container ID at runtime, which would stop the app listening on 127.0.0.1.
CMD ["sh", "-c", "./node_modules/.bin/tsx scripts/migrate.ts && HOSTNAME=0.0.0.0 node server.js"]
