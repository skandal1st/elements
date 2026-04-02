#!/bin/bash
#
# Release script for Elements Platform
# Creates git tag and builds both editions
# Usage: ./scripts/release.sh VERSION EDITION
# Example: ./scripts/release.sh 1.0.0 both
#

set -e

VERSION=$1
EDITION=${2:-both}

if [ -z "$VERSION" ]; then
    echo "Error: Version is required"
    echo "Usage: ./scripts/release.sh VERSION [EDITION]"
    echo "Example: ./scripts/release.sh 1.0.0 both"
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=============================================="
echo "Elements Platform Release"
echo "Version: $VERSION"
echo "Edition: $EDITION"
echo "=============================================="
echo ""

# Validate git status
echo -e "${BLUE}[1/6]${NC} Checking git status..."
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}✗${NC} You have uncommitted changes"
    echo "Please commit or stash changes before releasing"
    exit 1
fi

echo -e "${GREEN}✓${NC} Working directory is clean"
echo ""

# Create changelog entry
echo -e "${BLUE}[2/6]${NC} Update CHANGELOG.md before continuing"
echo "Press Enter when ready..."
read

# Build editions
if [ "$EDITION" == "core" ] || [ "$EDITION" == "both" ]; then
    echo -e "${BLUE}[3/6]${NC} Building Core Edition..."
    ./scripts/build-core.sh $VERSION
    echo ""
fi

if [ "$EDITION" == "enterprise" ] || [ "$EDITION" == "both" ]; then
    echo -e "${BLUE}[4/6]${NC} Building Enterprise Edition..."
    ./scripts/build-enterprise.sh $VERSION
    echo ""
fi

# Create git tags
echo -e "${BLUE}[5/6]${NC} Creating git tags..."

if [ "$EDITION" == "core" ] || [ "$EDITION" == "both" ]; then
    TAG_CORE="v${VERSION}-core"
    git tag -a $TAG_CORE -m "Release $VERSION (Core Edition)"
    echo "Created tag: $TAG_CORE"
fi

if [ "$EDITION" == "enterprise" ] || [ "$EDITION" == "both" ]; then
    TAG_ENT="v${VERSION}-enterprise"
    git tag -a $TAG_ENT -m "Release $VERSION (Enterprise Edition)"
    echo "Created tag: $TAG_ENT"
fi

echo -e "${GREEN}✓${NC} Tags created"
echo ""

# Push tags
echo -e "${BLUE}[6/6]${NC} Push tags and images?"
echo "This will:"
if [ "$EDITION" == "core" ] || [ "$EDITION" == "both" ]; then
    echo "  - Push git tag v${VERSION}-core"
    echo "  - Push Core images to registry"
fi
if [ "$EDITION" == "enterprise" ] || [ "$EDITION" == "both" ]; then
    echo "  - Push git tag v${VERSION}-enterprise"
    echo "  - Push Enterprise images to registry"
fi
echo ""
echo "Continue? (y/N)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    # Push git tags
    echo "Pushing git tags..."
    git push origin --tags

    # Push Docker images
    if [ "$EDITION" == "core" ] || [ "$EDITION" == "both" ]; then
        echo "Pushing Core images..."
        ./scripts/push-core.sh $VERSION
    fi

    if [ "$EDITION" == "enterprise" ] || [ "$EDITION" == "both" ]; then
        echo "Pushing Enterprise images..."
        ./scripts/push-enterprise.sh $VERSION
    fi

    echo ""
    echo "=============================================="
    echo -e "${GREEN}✓ Release $VERSION complete!${NC}"
    echo "=============================================="
    echo ""
    echo "Next steps:"
    echo "  1. Create GitHub release at https://github.com/elements/elements-platform/releases/new"
    echo "  2. Update production deployments"
    echo "  3. Notify customers about new version"
    echo ""
else
    echo "Release cancelled. Tags created locally but not pushed."
    echo "To push later, run:"
    echo "  git push origin --tags"
    if [ "$EDITION" == "core" ] || [ "$EDITION" == "both" ]; then
        echo "  ./scripts/push-core.sh $VERSION"
    fi
    if [ "$EDITION" == "enterprise" ] || [ "$EDITION" == "both" ]; then
        echo "  ./scripts/push-enterprise.sh $VERSION"
    fi
fi
