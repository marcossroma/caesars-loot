FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/game-math/package.json packages/game-math/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace=@caesars-loot/shared && npm run build --workspace=@caesars-loot/game-math && npm run build --workspace=@caesars-loot/config && npm run build --workspace=@caesars-loot/server
ENV NODE_ENV=production
USER node
CMD ["npm", "run", "start", "--workspace=@caesars-loot/server"]
