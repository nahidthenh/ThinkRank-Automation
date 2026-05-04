FROM wordpress:latest

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    curl \
    less \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Install WP-CLI
RUN curl -sL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar \
    -o /usr/local/bin/wp \
    && chmod +x /usr/local/bin/wp

# Install Composer
RUN curl -sS https://getcomposer.org/installer \
    | php -- --install-dir=/usr/local/bin --filename=composer \
    && chmod +x /usr/local/bin/composer

# Allow WP-CLI to run as root (needed inside container)
RUN mkdir -p /root/.wp-cli && \
    printf 'apache_modules:\n  - mod_rewrite\n' > /root/.wp-cli/config.yml

# Set COMPOSER_ALLOW_SUPERUSER to suppress root warning
ENV COMPOSER_ALLOW_SUPERUSER=1

# Suppress Apache ServerName warning
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Enable Apache mod_rewrite for WordPress permalinks
RUN a2enmod rewrite
