#!/bin/bash
#
# Push script for Elements Platform Enterprise Edition
# Usage: ./scripts/push-enterprise.sh [VERSION]
#

set -e

VERSION=${1:-latest}
REGISTRY=${REGISTRY:-registry.elements.io}

echo "=============================================="
echo "Pushing Elements Enterprise Edition to Registry"
echo "Version: $VERSION"
echo "Registry: $REGISTRY"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if logged in to registry
echo -e "${BLUE}[1/3]${NC} Checking registry authentication..."
if ! docker login ${REGISTRY} 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC} Please login to registry:"
    docker login ${REGISTRY}
fi

echo -e "${GREEN}✓${NC} Registry authentication OK"
echo ""

echo -e "${BLUE}[2/3]${NC} Pushing backend images..."
docker push ${REGISTRY}/elements-enterprise-backend:${VERSION}
docker push ${REGISTRY}/elements-enterprise-backend:latest

echo -e "${GREEN}✓${NC} Backend images pushed"
echo ""

echo -e "${BLUE}[3/3]${NC} Pushing frontend images..."
docker push ${REGISTRY}/elements-enterprise-frontend:${VERSION}
docker push ${REGISTRY}/elements-enterprise-frontend:latest

echo -e "${GREEN}✓${NC} Frontend images pushed"
echo ""

echo "=============================================="
echo "Pushed images:"
echo "  - ${REGISTRY}/elements-enterprise-backend:${VERSION}"
echo "  - ${REGISTRY}/elements-enterprise-backend:latest"
echo "  - ${REGISTRY}/elements-enterprise-frontend:${VERSION}"
echo "  - ${REGISTRY}/elements-enterprise-frontend:latest"
echo "=============================================="
echo ""

echo -e "${GREEN}✓ Enterprise Edition push complete!${NC}"
echo ""
echo "Images are now available at:"
echo "  ${REGISTRY}/elements-enterprise-backend:${VERSION}"
echo "  ${REGISTRY}/elements-enterprise-frontend:${VERSION}"
echo ""
