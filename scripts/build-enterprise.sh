#!/bin/bash
#
# Build script for Elements Platform Enterprise Edition
# Usage: ./scripts/build-enterprise.sh [VERSION]
#

set -e

VERSION=${1:-latest}
REGISTRY=${REGISTRY:-registry.elements.io}

echo "=============================================="
echo "Building Elements Enterprise Edition"
echo "Version: $VERSION"
echo "Registry: $REGISTRY"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[1/4]${NC} Building backend image..."
docker build \
  -f backend/Dockerfile.enterprise \
  -t elements-enterprise-backend:${VERSION} \
  -t elements-enterprise-backend:latest \
  -t ${REGISTRY}/elements-enterprise-backend:${VERSION} \
  -t ${REGISTRY}/elements-enterprise-backend:latest \
  .

echo -e "${GREEN}✓${NC} Backend image built successfully"
echo ""

echo -e "${BLUE}[2/4]${NC} Building frontend image..."
cd frontend
docker build \
  -f Dockerfile.enterprise \
  --build-arg VITE_EDITION=enterprise \
  -t elements-enterprise-frontend:${VERSION} \
  -t elements-enterprise-frontend:latest \
  -t ${REGISTRY}/elements-enterprise-frontend:${VERSION} \
  -t ${REGISTRY}/elements-enterprise-frontend:latest \
  .
cd ..

echo -e "${GREEN}✓${NC} Frontend image built successfully"
echo ""

echo -e "${BLUE}[3/4]${NC} Listing built images..."
docker images | grep elements-enterprise

echo ""
echo -e "${BLUE}[4/4]${NC} Build summary"
echo "=============================================="
echo "Backend images:"
echo "  - elements-enterprise-backend:${VERSION}"
echo "  - elements-enterprise-backend:latest"
echo "  - ${REGISTRY}/elements-enterprise-backend:${VERSION}"
echo "  - ${REGISTRY}/elements-enterprise-backend:latest"
echo ""
echo "Frontend images:"
echo "  - elements-enterprise-frontend:${VERSION}"
echo "  - elements-enterprise-frontend:latest"
echo "  - ${REGISTRY}/elements-enterprise-frontend:${VERSION}"
echo "  - ${REGISTRY}/elements-enterprise-frontend:latest"
echo "=============================================="
echo ""

echo -e "${GREEN}✓ Enterprise Edition build complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Test locally: docker-compose -f docker-compose.enterprise.yml up"
echo "  2. Push to registry: ./scripts/push-enterprise.sh ${VERSION}"
echo ""
