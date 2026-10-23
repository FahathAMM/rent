# ---- Dependencies ---------------------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && mkdir -p storage/app/public \
    && ln -sfn ../storage/app/public public/storage

# ---- Runtime ---------------------------------------------------------------
# nginx + php-fpm in one container (supervisord manages both) — the
# simplest topology for this app's size, and it sidesteps having to keep a
# separately-built nginx image's copy of public/ in sync with the app image.
FROM php:8.2-fpm-alpine

RUN apk add --no-cache \
        bash \
        curl \
        freetype-dev \
        icu-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libzip-dev \
        nginx \
        oniguruma-dev \
        supervisor \
        zip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        exif \
        gd \
        intl \
        mbstring \
        pcntl \
        pdo_mysql \
        zip \
    && apk del freetype-dev icu-dev libjpeg-turbo-dev libpng-dev libzip-dev oniguruma-dev

WORKDIR /var/www/html

COPY --from=vendor /app ./
COPY docker/php.ini /usr/local/etc/php/conf.d/99-custom.ini
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# sed strips CRLF in case this was checked out/edited on Windows — a CRLF
# shebang line makes the interpreter unresolvable inside the Linux image.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh \
    && chown -R www-data:www-data storage bootstrap/cache public/storage

EXPOSE 80
ENTRYPOINT ["entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisord.conf"]
