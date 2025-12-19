#!/bin/bash
# Build and optionally publish the Shepherd extension

set -e

cd "$(dirname "$0")/.."

# Load .env file if it exists (for VSCE_PAT)
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to increment version
increment_version() {
    local version="$1"
    local part="$2"

    IFS='.' read -r major minor patch <<< "$version"

    case $part in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

# Function to handle version bumping
bump_version() {
    # Get current version from package.json
    CURRENT_VERSION=$(node -p "require('./package.json').version")

    echo -e "${BLUE}Version Bump${NC}"
    echo "============"
    echo ""
    echo "Current version: ${YELLOW}${CURRENT_VERSION}${NC}"
    echo ""
    echo "Increment which part?"
    echo "  1) Patch (${CURRENT_VERSION} → $(increment_version $CURRENT_VERSION patch))"
    echo "  2) Minor (${CURRENT_VERSION} → $(increment_version $CURRENT_VERSION minor))"
    echo "  3) Major (${CURRENT_VERSION} → $(increment_version $CURRENT_VERSION major))"
    echo "  4) Cancel"
    echo ""
    read -p "Select option [1-4]: " version_choice

    case $version_choice in
        1) NEW_VERSION=$(increment_version $CURRENT_VERSION patch) ;;
        2) NEW_VERSION=$(increment_version $CURRENT_VERSION minor) ;;
        3) NEW_VERSION=$(increment_version $CURRENT_VERSION major) ;;
        4|*) echo "Cancelled."; return 1 ;;
    esac

    echo ""
    echo -e "Proposed change: ${YELLOW}${CURRENT_VERSION}${NC} → ${GREEN}${NEW_VERSION}${NC}"
    echo ""
    read -p "Proceed with version bump? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        return 1
    fi

    # Update package.json version using node
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
        pkg.version = '${NEW_VERSION}';
        fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    echo -e "${GREEN}Updated package.json to version ${NEW_VERSION}${NC}"

    # Ask about git commit
    echo ""
    read -p "Commit this change to git? [y/N]: " do_commit
    if [[ "$do_commit" =~ ^[Yy]$ ]]; then
        git add package.json
        git commit -m "chore: bump version to ${NEW_VERSION}"
        echo -e "${GREEN}Committed to git${NC}"

        # Ask about git push
        echo ""
        read -p "Push to remote? [y/N]: " do_push
        if [[ "$do_push" =~ ^[Yy]$ ]]; then
            git push
            echo -e "${GREEN}Pushed to remote${NC}"
        fi
    fi

    echo ""
    echo -e "${GREEN}Version bump complete!${NC}"
    return 0
}

echo -e "${BLUE}Shepherd Extension Builder${NC}"
echo "=========================="
echo ""

# Prompt for action
echo "What would you like to do?"
echo "  1) Build only (create .vsix package)"
echo "  2) Build and publish"
echo "  3) Publish only (skip build)"
echo "  4) Bump version"
echo ""
read -p "Select option [1-4]: " action

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
    4)
        bump_version
        exit $?
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# For build/publish operations, ask about version bump first
if [ "$DO_BUILD" = true ] || [ "$DO_PUBLISH" = true ]; then
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    echo ""
    echo -e "Current version: ${YELLOW}${CURRENT_VERSION}${NC}"
    read -p "Increment version before proceeding? [y/N]: " do_bump
    if [[ "$do_bump" =~ ^[Yy]$ ]]; then
        if bump_version; then
            echo ""
        else
            echo ""
            read -p "Continue without version bump? [y/N]: " continue_anyway
            if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
                echo "Cancelled."
                exit 0
            fi
        fi
    fi
fi

# If publishing, check for PAT and ask about pre-release
PRE_RELEASE=""
if [ "$DO_PUBLISH" = true ]; then
    # Check for VSCE_PAT
    if [ -z "$VSCE_PAT" ]; then
        echo ""
        echo -e "${YELLOW}No VSCE_PAT found in environment or .env file.${NC}"
        echo "Create a .env file with: VSCE_PAT=your_token_here"
        echo "Or export VSCE_PAT in your shell."
        echo ""
        read -p "Enter your Personal Access Token (or Ctrl+C to cancel): " VSCE_PAT
        export VSCE_PAT
    fi

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

# Build (vsce package runs vscode:prepublish automatically, so we don't need to compile first)
if [ "$DO_BUILD" = true ]; then
    echo ""
    echo -e "${BLUE}Packaging extension (includes compilation)...${NC}"
    npx @vscode/vsce package --no-dependencies --allow-missing-repository

    echo ""
    echo -e "${GREEN}Package created:${NC}"
    ls -la *.vsix 2>/dev/null || echo "No .vsix file found"
fi

# Publish
if [ "$DO_PUBLISH" = true ]; then
    echo ""
    echo -e "${BLUE}Publishing to VS Code Marketplace...${NC}"
    npx @vscode/vsce publish --no-dependencies --allow-missing-repository $PRE_RELEASE

    echo ""
    echo -e "${GREEN}Published successfully!${NC}"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
