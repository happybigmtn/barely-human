#!/bin/bash
# Barely Human - Production Deployment Script

set -e

# Configuration
PROJECT_NAME="barely-human"
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.production"

echo "🚀 Deploying Barely Human to Production..."

# Function to check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed"
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f "${ENV_FILE}" ]; then
        echo "❌ Production environment file ${ENV_FILE} not found"
        echo "📋 Create ${ENV_FILE} with required environment variables"
        exit 1
    fi
    
    # Check if secrets directory exists
    if [ ! -d "./secrets" ]; then
        echo "❌ Secrets directory not found"
        echo "📋 Create ./secrets directory with required secret files"
        exit 1
    fi
    
    echo "✅ Prerequisites check passed"
}

# Function to setup secrets
setup_secrets() {
    echo "🔐 Setting up secrets..."
    
    # Create secrets directory if it doesn't exist
    mkdir -p ./secrets
    
    # Check required secret files
    REQUIRED_SECRETS=(
        "private_key.txt"
        "chainlink_vrf_key.txt" 
        "postgres_password.txt"
        "grafana_password.txt"
    )
    
    for secret in "${REQUIRED_SECRETS[@]}"; do
        if [ ! -f "./secrets/${secret}" ]; then
            echo "⚠️  Missing secret file: ./secrets/${secret}"
            
            case "${secret}" in
                "private_key.txt")
                    echo "💡 Generate with: openssl rand -hex 32 > ./secrets/private_key.txt"
                    ;;
                "postgres_password.txt")
                    echo "💡 Generate with: openssl rand -base64 32 > ./secrets/postgres_password.txt"
                    ;;
                "grafana_password.txt")
                    echo "💡 Generate with: openssl rand -base64 16 > ./secrets/grafana_password.txt"
                    ;;
                "chainlink_vrf_key.txt")
                    echo "💡 Get from Chainlink VRF subscription"
                    ;;
            esac
        fi
    done
    
    # Set correct permissions on secrets
    chmod 600 ./secrets/*.txt
    
    echo "✅ Secrets setup complete"
}

# Function to build images
build_images() {
    echo "🔨 Building Docker images..."
    
    # Build with no cache for production
    docker-compose -f ${DOCKER_COMPOSE_FILE} build --no-cache
    
    echo "✅ Images built successfully"
}

# Function to setup SSL certificates
setup_ssl() {
    echo "🔐 Setting up SSL certificates..."
    
    # Check if SSL script exists
    if [ -f "./scripts/ssl-setup.sh" ]; then
        chmod +x ./scripts/ssl-setup.sh
        ./scripts/ssl-setup.sh production
    else
        echo "⚠️  SSL setup script not found, using self-signed certificates"
        ./scripts/ssl-setup.sh development
    fi
    
    echo "✅ SSL setup complete"
}

# Function to setup database
setup_database() {
    echo "🗄️  Setting up database..."
    
    # Start PostgreSQL container first
    docker-compose -f ${DOCKER_COMPOSE_FILE} up -d postgres
    
    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 30
    
    # Check if database is accessible
    docker-compose -f ${DOCKER_COMPOSE_FILE} exec postgres pg_isready -U postgres
    
    echo "✅ Database setup complete"
}

# Function to start services
start_services() {
    echo "🚀 Starting all services..."
    
    # Load environment variables
    export $(cat ${ENV_FILE} | xargs)
    
    # Start all services
    docker-compose -f ${DOCKER_COMPOSE_FILE} up -d
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to start..."
    sleep 60
    
    echo "✅ All services started"
}

# Function to verify deployment
verify_deployment() {
    echo "🔍 Verifying deployment..."
    
    # Check service status
    docker-compose -f ${DOCKER_COMPOSE_FILE} ps
    
    # Check health endpoints
    SERVICES=(
        "http://localhost/health"
        "http://localhost:3000/api/health"
        "http://localhost:9090/api/v1/query?query=up"
    )
    
    for service in "${SERVICES[@]}"; do
        echo "🔗 Checking ${service}..."
        if curl -f -s "${service}" > /dev/null; then
            echo "✅ ${service} is healthy"
        else
            echo "❌ ${service} is not responding"
        fi
    done
    
    echo "✅ Deployment verification complete"
}

# Function to show deployment info
show_info() {
    echo ""
    echo "🎉 Barely Human Production Deployment Complete!"
    echo ""
    echo "📊 Monitoring:"
    echo "  - Grafana: http://localhost:3000"
    echo "  - Prometheus: http://localhost:9090"
    echo ""
    echo "🔧 Management Commands:"
    echo "  - View logs: docker-compose logs -f [service]"
    echo "  - Restart service: docker-compose restart [service]"
    echo "  - Scale service: docker-compose up -d --scale [service]=N"
    echo "  - Stop all: docker-compose down"
    echo ""
    echo "📁 Important Directories:"
    echo "  - Logs: ./logs/"
    echo "  - SSL Certificates: ./ssl/"
    echo "  - Secrets: ./secrets/"
    echo ""
    echo "🔗 Application URLs:"
    echo "  - Main Site: https://barelyhuman.xyz"
    echo "  - API: https://api.barelyhuman.xyz"
    echo "  - Metadata: https://api.barelyhuman.xyz/collection"
    echo ""
}

# Function for cleanup on failure
cleanup_on_failure() {
    echo "❌ Deployment failed, cleaning up..."
    docker-compose -f ${DOCKER_COMPOSE_FILE} down
    exit 1
}

# Set trap for cleanup
trap cleanup_on_failure ERR

# Main deployment sequence
main() {
    echo "🚀 Starting Barely Human Production Deployment"
    echo "================================================"
    
    check_prerequisites
    setup_secrets
    setup_ssl
    build_images
    setup_database
    start_services
    verify_deployment
    show_info
    
    echo "🎉 Deployment completed successfully!"
}

# Run main function
main "$@"