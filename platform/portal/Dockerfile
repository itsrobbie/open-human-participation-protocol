FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_ENABLE_PROTOCOL_LAB=false
ENV VITE_ENABLE_PROTOCOL_LAB=$VITE_ENABLE_PROTOCOL_LAB
# Browser telemetry endpoint (U7.1). Baked at build time by Vite; the browser
# reaches the OTel Collector's OTLP/HTTP port on the host. Empty => telemetry off.
ARG VITE_OTEL_EXPORTER_OTLP_ENDPOINT=""
ENV VITE_OTEL_EXPORTER_OTLP_ENDPOINT=$VITE_OTEL_EXPORTER_OTLP_ENDPOINT
ARG VITE_OTEL_SERVICE_NAME="ohpp.portal"
ENV VITE_OTEL_SERVICE_NAME=$VITE_OTEL_SERVICE_NAME
# Verbose browser OTel diagnostics (dev/test only). Empty in prod.
ARG VITE_OTEL_DEBUG=""
ENV VITE_OTEL_DEBUG=$VITE_OTEL_DEBUG
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx tsc && npx vite build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
