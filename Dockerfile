FROM node:24-bookworm-slim
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx playwright install --with-deps chromium \
    && apt-get update && apt-get install -y --no-install-recommends gosu util-linux \
    && rm -rf /var/lib/apt/lists/* && chmod -R a+rX /ms-playwright
COPY --chown=node:node . .
RUN mkdir -p /var/data && chown node:node /var/data
EXPOSE 10000
ENTRYPOINT ["sh", "scripts/container-entrypoint.sh"]
CMD ["node", "apps/server/src/index.js"]
