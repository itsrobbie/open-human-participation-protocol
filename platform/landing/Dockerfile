# OHPP World landing page — a self-contained static site (no build, no backend,
# no DB, no auth). It only links out to the other services; it never proxies or
# depends on them, so it starts instantly and works whether or not they are up.
FROM nginx:alpine
COPY public /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
