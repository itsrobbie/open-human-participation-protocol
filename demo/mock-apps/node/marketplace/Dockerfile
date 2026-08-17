# Multi-stage build: SDK + backend + frontend in one image
FROM node:20-alpine AS sdk-build
WORKDIR /sdk
COPY sdks/node/package.json sdks/node/tsconfig.json ./
COPY sdks/node/src/ ./src/
RUN npm install && npm run build

FROM node:20-alpine AS client-build
WORKDIR /client
COPY demo/mock-apps/node/marketplace/client/package.json demo/mock-apps/node/marketplace/client/package-lock.json* ./
RUN npm install
COPY demo/mock-apps/node/marketplace/client/ ./
RUN npx vite build --outDir /public

FROM node:20-alpine AS backend-build
WORKDIR /app
COPY --from=sdk-build /sdk /sdk
COPY demo/mock-apps/node/marketplace/package.json ./
# Replace the relative SDK path with the Docker-internal path and install without lockfile
RUN sed -i 's|"file:../../../../sdks/node"|"file:../../../sdk"|' package.json \
    && npm install --install-links
COPY demo/mock-apps/node/marketplace/src/ ./src/
COPY demo/mock-apps/node/marketplace/tsconfig.json ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=backend-build /app/dist ./dist/
COPY --from=backend-build /app/node_modules ./node_modules/
COPY --from=backend-build /app/package.json ./
COPY --from=client-build /public ./public/
EXPOSE 5040
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
