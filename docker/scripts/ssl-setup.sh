#!/bin/bash
# Barely Human - SSL Certificate Setup Script

set -e

# Configuration
DOMAIN="barelyhuman.xyz"
API_DOMAIN="api.barelyhuman.xyz"
EMAIL="admin@barelyhuman.xyz"
NGINX_CONF_DIR="./nginx"
SSL_DIR="./ssl"

echo "🔐 Setting up SSL certificates for Barely Human..."

# Create SSL directory
mkdir -p ${SSL_DIR}
mkdir -p ${NGINX_CONF_DIR}/conf.d

# Check if running in production or staging
if [ "$1" = "staging" ]; then
    echo "📋 Using Let's Encrypt STAGING environment"
    STAGING_FLAG="--staging"
else
    echo "🚀 Using Let's Encrypt PRODUCTION environment"
    STAGING_FLAG=""
fi

# Function to generate self-signed certificates for development
generate_self_signed() {
    echo "🔧 Generating self-signed certificates for development..."
    
    # Generate private key
    openssl genrsa -out ${SSL_DIR}/${DOMAIN}.key 2048
    openssl genrsa -out ${SSL_DIR}/${API_DOMAIN}.key 2048
    
    # Generate certificate signing request
    openssl req -new -key ${SSL_DIR}/${DOMAIN}.key \
        -out ${SSL_DIR}/${DOMAIN}.csr \
        -subj "/C=US/ST=CA/L=San Francisco/O=Barely Human/CN=${DOMAIN}"
    
    openssl req -new -key ${SSL_DIR}/${API_DOMAIN}.key \
        -out ${SSL_DIR}/${API_DOMAIN}.csr \
        -subj "/C=US/ST=CA/L=San Francisco/O=Barely Human/CN=${API_DOMAIN}"
    
    # Generate self-signed certificates
    openssl x509 -req -in ${SSL_DIR}/${DOMAIN}.csr \
        -signkey ${SSL_DIR}/${DOMAIN}.key \
        -out ${SSL_DIR}/${DOMAIN}.crt \
        -days 365
    
    openssl x509 -req -in ${SSL_DIR}/${API_DOMAIN}.csr \
        -signkey ${SSL_DIR}/${API_DOMAIN}.key \
        -out ${SSL_DIR}/${API_DOMAIN}.crt \
        -days 365
    
    echo "✅ Self-signed certificates generated"
}

# Function to setup Let's Encrypt certificates
setup_letsencrypt() {
    echo "🌐 Setting up Let's Encrypt certificates..."
    
    # Install certbot if not present
    if ! command -v certbot &> /dev/null; then
        echo "📦 Installing certbot..."
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Stop nginx if running
    docker-compose down nginx 2>/dev/null || true
    
    # Generate certificates
    certbot certonly --standalone \
        --email ${EMAIL} \
        --agree-tos \
        --no-eff-email \
        ${STAGING_FLAG} \
        -d ${DOMAIN} \
        -d www.${DOMAIN} \
        -d ${API_DOMAIN}
    
    # Copy certificates to SSL directory
    cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${SSL_DIR}/${DOMAIN}.crt
    cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${SSL_DIR}/${DOMAIN}.key
    cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${SSL_DIR}/${API_DOMAIN}.crt
    cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${SSL_DIR}/${API_DOMAIN}.key
    
    # Set correct permissions
    chmod 644 ${SSL_DIR}/*.crt
    chmod 600 ${SSL_DIR}/*.key
    
    echo "✅ Let's Encrypt certificates installed"
}

# Function to setup certificate renewal
setup_renewal() {
    echo "🔄 Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > /etc/cron.d/letsencrypt-renewal << EOF
# Barely Human SSL Certificate Renewal
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Attempt renewal every 12 hours
0 */12 * * * root certbot renew --quiet --hook-post "docker-compose -f ${PWD}/docker-compose.yml restart nginx"
EOF
    
    echo "✅ Automatic renewal configured"
}

# Function to generate DH parameters
generate_dhparam() {
    echo "🔐 Generating DH parameters (this may take a while)..."
    
    if [ ! -f ${SSL_DIR}/dhparam.pem ]; then
        openssl dhparam -out ${SSL_DIR}/dhparam.pem 2048
        echo "✅ DH parameters generated"
    else
        echo "ℹ️  DH parameters already exist"
    fi
}

# Function to create security headers config
create_security_config() {
    echo "🛡️  Creating security configuration..."
    
    cat > ${NGINX_CONF_DIR}/conf.d/security.conf << EOF
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Hide Nginx version
server_tokens off;

# SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_dhparam /etc/ssl/certs/dhparam.pem;
EOF
    
    echo "✅ Security configuration created"
}

# Main execution
main() {
    case "${1:-development}" in
        "production")
            setup_letsencrypt
            setup_renewal
            ;;
        "staging")
            setup_letsencrypt
            ;;
        "development"|*)
            generate_self_signed
            ;;
    esac
    
    generate_dhparam
    create_security_config
    
    echo ""
    echo "🎉 SSL setup complete!"
    echo "📁 Certificates location: ${SSL_DIR}/"
    echo "🔧 Nginx config: ${NGINX_CONF_DIR}/"
    echo ""
    echo "Next steps:"
    echo "1. Review nginx configuration"
    echo "2. Start services: docker-compose up -d"
    echo "3. Test SSL: curl -I https://${DOMAIN}"
}

# Run main function
main "$@"