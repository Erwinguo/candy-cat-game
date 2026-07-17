FROM nginx:1.27-alpine

COPY index.html styles.css game.js config.js /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY vendor /usr/share/nginx/html/vendor
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/frontend-entrypoint.sh /docker-entrypoint.d/40-tangdou-config.sh

RUN chmod +x /docker-entrypoint.d/40-tangdou-config.sh
