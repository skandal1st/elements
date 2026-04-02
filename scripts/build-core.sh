#!/bin/bash
#
# Build script for Elements Platform Core Edition
# Usage: ./scripts/build-core.sh [VERSION]
#

set -e

VERSION=${1:-latest}
REGISTRY=${REGISTRY:-registry.elements.io}

echo "=============================================="
echo "Building Elements Core Edition"
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
  -f backend/Dockerfile.core \
  -t elements-core-backend:${VERSION} \
  -t elements-core-backend:latest \
  -t ${REGISTRY}/elements-core-backend:${VERSION} \
  -t ${REGISTRY}/elements-core-backend:latest \
  .

echo -e "${GREEN}✓${NC} Backend image built successfully"
echo ""

echo -e "${BLUE}[2/4]${NC} Building frontend image..."
cd frontend
docker build \
  -f Dockerfile.core \
  --build-arg VITE_EDITION=core \
  -t elements-core-frontend:${VERSION} \
  -t elements-core-frontend:latest \
  -t ${REGISTRY}/elements-core-frontend:${VERSION} \
  -t ${REGISTRY}/elements-core-frontend:latest \
  .
cd ..

echo -e "${GREEN}✓${NC} Frontend image built successfully"
echo ""

echo -e "${BLUE}[3/4]${NC} Listing built images..."
docker images | grep elements-core

echo ""
echo -e "${BLUE}[4/4]${NC} Build summary"
echo "=============================================="
echo "Backend images:"
echo "  - elements-core-backend:${VERSION}"
echo "  - elements-core-backend:latest"
echo "  - ${REGISTRY}/elements-core-backend:${VERSION}"
echo "  - ${REGISTRY}/elements-core-backend:latest"
echo ""
echo "Frontend images:"
echo "  - elements-core-frontend:${VERSION}"
echo "  - elements-core-frontend:latest"
echo "  - ${REGISTRY}/elements-core-frontend:${VERSION}"
echo "  - ${REGISTRY}/elements-core-frontend:latest"
echo "=============================================="
echo ""

echo -e "${GREEN}✓ Core Edition build complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Test locally: docker-compose -f docker-compose.core.yml up"
echo "  2. Push to registry: ./scripts/push-core.sh ${VERSION}"
echo ""
