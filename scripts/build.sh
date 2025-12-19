#!/bin/bash
# Build and package the Shepherd extension for distribution

set -e

cd "$(dirname "$0")/.."

echo "Compiling TypeScript..."
npm run compile

echo ""
echo "Packaging extension..."
npx @vscode/vsce package --no-dependencies

echo ""
echo "Done! Extension packaged successfully."
ls -la *.vsix 2>/dev/null || echo "No .vsix file found"
