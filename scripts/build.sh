#!/bin/bash
# Build the Shepherd extension

set -e

cd "$(dirname "$0")/.."

echo "Building extension..."
npm run compile

echo ""
echo "Done! Extension built successfully."
echo "Press F5 in VS Code to run the extension."
