#!/bin/bash
# Build and optionally publish the Shepherd extension

set -e

cd "$(dirname "$0")/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Shepherd Extension Builder${NC}"
echo "=========================="
echo ""

# Prompt for action
echo "What would you like to do?"
echo "  1) Build only (create .vsix package)"
echo "  2) Build and publish"
echo "  3) Publish only (skip build)"
echo ""
read -p "Select option [1-3]: " action

case $action in
    1)
        DO_BUILD=true
        DO_PUBLISH=false
        ;;
    2)
        DO_BUILD=true
        DO_PUBLISH=true
        ;;
    3)
        DO_BUILD=false
        DO_PUBLISH=true
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# If publishing, ask about pre-release
PRE_RELEASE=""
if [ "$DO_PUBLISH" = true ]; then
    echo ""
    echo "Publish as:"
    echo "  1) Pre-release (unlisted, won't appear in search)"
    echo "  2) Regular release (public, appears in search)"
    echo ""
    read -p "Select option [1-2]: " release_type

    case $release_type in
        1)
            PRE_RELEASE="--pre-release"
            echo -e "${YELLOW}Will publish as PRE-RELEASE (unlisted)${NC}"
            ;;
        2)
            PRE_RELEASE=""
            echo -e "${YELLOW}Will publish as REGULAR release (public)${NC}"
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            exit 1
            ;;
    esac

    # Confirm before publishing
    echo ""
    read -p "Are you sure you want to publish? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Build
if [ "$DO_BUILD" = true ]; then
    echo ""
    echo -e "${BLUE}Compiling TypeScript...${NC}"
    npm run compile

    echo ""
    echo -e "${BLUE}Packaging extension...${NC}"
    npx @vscode/vsce package --no-dependencies

    echo ""
    echo -e "${GREEN}Package created:${NC}"
    ls -la *.vsix 2>/dev/null || echo "No .vsix file found"
fi

# Publish
if [ "$DO_PUBLISH" = true ]; then
    echo ""
    echo -e "${BLUE}Publishing to VS Code Marketplace...${NC}"
    npx @vscode/vsce publish --no-dependencies $PRE_RELEASE

    echo ""
    echo -e "${GREEN}Published successfully!${NC}"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
