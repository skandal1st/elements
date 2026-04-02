# Elements Platform Build Scripts

This directory contains scripts for building, releasing, and managing Elements Platform editions.

## Available Scripts

### Build Scripts

**`build-core.sh [VERSION]`**
- Builds Core Edition Docker images
- Default version: `latest`
- Example: `./scripts/build-core.sh 1.0.0`

**`build-enterprise.sh [VERSION]`**
- Builds Enterprise Edition Docker images
- Default version: `latest`
- Example: `./scripts/build-enterprise.sh 1.0.0`

### Push Scripts

**`push-core.sh [VERSION]`**
- Pushes Core Edition images to Docker registry
- Requires authentication to registry
- Example: `./scripts/push-core.sh 1.0.0`

**`push-enterprise.sh [VERSION]`**
- Pushes Enterprise Edition images to Docker registry
- Requires authentication to registry
- Example: `./scripts/push-enterprise.sh 1.0.0`

### Release Script

**`release.sh VERSION [EDITION]`**
- Complete release workflow
- Creates git tags
- Builds images
- Optionally pushes to registry
- EDITION: `core`, `enterprise`, or `both` (default)
- Example: `./scripts/release.sh 1.0.0 both`

## Usage Examples

### Development Build

Build Core edition for local testing:
```bash
./scripts/build-core.sh dev
docker-compose -f docker-compose.core.yml up
```

Build Enterprise edition for local testing:
```bash
./scripts/build-enterprise.sh dev
docker-compose -f docker-compose.enterprise.yml up
```

### Production Release

Full release workflow:
```bash
# 1. Ensure clean git state
git status

# 2. Update CHANGELOG.md with release notes

# 3. Commit changes
git add CHANGELOG.md
git commit -m "Prepare release 1.0.0"

# 4. Run release script
./scripts/release.sh 1.0.0 both

# This will:
# - Build both editions
# - Create git tags (v1.0.0-core, v1.0.0-enterprise)
# - Prompt to push tags and images
```

### Manual Release Steps

If you prefer manual control:

```bash
# 1. Build Core
./scripts/build-core.sh 1.0.0

# 2. Build Enterprise
./scripts/build-enterprise.sh 1.0.0

# 3. Test locally
docker-compose -f docker-compose.core.yml up -d
# ... test ...
docker-compose -f docker-compose.core.yml down

# 4. Create tags
git tag -a v1.0.0-core -m "Release 1.0.0 Core"
git tag -a v1.0.0-enterprise -m "Release 1.0.0 Enterprise"

# 5. Push tags
git push origin --tags

# 6. Push images
./scripts/push-core.sh 1.0.0
./scripts/push-enterprise.sh 1.0.0
```

## Environment Variables

**`REGISTRY`**
- Docker registry URL
- Default: `registry.elements.io`
- Override: `REGISTRY=myregistry.com ./scripts/build-core.sh 1.0.0`

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Git
- Bash shell
- Registry credentials (for push operations)

## Registry Authentication

Before pushing images, authenticate to the registry:

```bash
docker login registry.elements.io
Username: your-username
Password: your-password
```

Or set environment variables:
```bash
export DOCKER_USERNAME=your-username
export DOCKER_PASSWORD=your-password
echo "$DOCKER_PASSWORD" | docker login registry.elements.io -u "$DOCKER_USERNAME" --password-stdin
```

## Build Output

After successful build, you'll have these images:

**Core Edition:**
- `elements-core-backend:VERSION`
- `elements-core-backend:latest`
- `registry.elements.io/elements-core-backend:VERSION`
- `registry.elements.io/elements-core-backend:latest`
- `elements-core-frontend:VERSION`
- `elements-core-frontend:latest`
- `registry.elements.io/elements-core-frontend:VERSION`
- `registry.elements.io/elements-core-frontend:latest`

**Enterprise Edition:**
- `elements-enterprise-backend:VERSION`
- `elements-enterprise-backend:latest`
- `registry.elements.io/elements-enterprise-backend:VERSION`
- `registry.elements.io/elements-enterprise-backend:latest`
- `elements-enterprise-frontend:VERSION`
- `elements-enterprise-frontend:latest`
- `registry.elements.io/elements-enterprise-frontend:VERSION`
- `registry.elements.io/elements-enterprise-frontend:latest`

## Troubleshooting

**"Cannot connect to Docker daemon"**
- Ensure Docker is running: `docker ps`

**"Permission denied"**
- Make scripts executable: `chmod +x scripts/*.sh`

**"Registry authentication required"**
- Login to registry: `docker login registry.elements.io`

**"Image build failed"**
- Check Dockerfile syntax
- Verify dependencies in requirements files
- Check build context (run from project root)

**"Push denied"**
- Verify registry credentials
- Check image name matches registry
- Ensure you have push permissions

## CI/CD Integration

These scripts can be used in CI/CD pipelines:

**GitHub Actions example:**
```yaml
- name: Build Core Edition
  run: ./scripts/build-core.sh ${{ github.ref_name }}

- name: Push to Registry
  env:
    DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
    DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
  run: |
    echo "$DOCKER_PASSWORD" | docker login registry.elements.io -u "$DOCKER_USERNAME" --password-stdin
    ./scripts/push-core.sh ${{ github.ref_name }}
```

## Version Naming Convention

- Production releases: `1.0.0`, `1.0.1`, `1.1.0`
- Release candidates: `1.0.0-rc.1`, `1.0.0-rc.2`
- Beta releases: `1.0.0-beta.1`, `1.0.0-beta.2`
- Development builds: `dev`, `dev-YYYYMMDD`

## Support

For issues with build scripts:
- Check logs in `docker-compose logs`
- Verify prerequisites are installed
- Contact DevOps team: devops@elements.io
