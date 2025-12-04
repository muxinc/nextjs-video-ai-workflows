#!/bin/bash
# Build and sync the @mux/ai package from sibling directory
# Turbopack doesn't handle symlinked packages well, so we copy the dist folder

set -e  # Exit on error

AI_DIR="../ai"
SOURCE="../ai/dist"
TARGET="lib/mux-ai"

echo "🔨 Building @mux/ai..."
cd "$AI_DIR"
npm run build
cd - > /dev/null

echo "📦 Syncing dist folder..."
rsync -av --delete "$SOURCE/" "$TARGET/"

echo "✅ Built and synced @mux/ai from ../ai/dist to lib/mux-ai"
