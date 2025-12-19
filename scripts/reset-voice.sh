#!/bin/bash
# Reset voice dependencies for testing the setup flow
# This script removes sox, whisper-cpp, and the whisper model

set -e

echo "Uninstalling sox..."
brew uninstall sox 2>/dev/null || echo "sox not installed"

echo "Uninstalling whisper-cpp..."
brew uninstall whisper-cpp 2>/dev/null || echo "whisper-cpp not installed"

echo "Removing whisper models..."
rm -rf ~/Library/Application\ Support/shepherd/whisper/models

echo ""
echo "Done! Voice dependencies have been removed."
echo "Press F5 in VS Code to test the setup flow."
