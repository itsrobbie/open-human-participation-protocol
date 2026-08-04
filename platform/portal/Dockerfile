FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_ENABLE_PROTOCOL_LAB=false
ENV VITE_ENABLE_PROTOCOL_LAB=$VITE_ENABLE_PROTOCOL_LAB
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx tsc && npx vite build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
