#!/bin/sh
# Builds the library and patches the BUNDLE_SIZE marker in README.md
# with the actual minified and gzip sizes from Vite's output.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
README="$ROOT/README.md"

# Build and capture output
BUILD_OUTPUT=$(cd "$ROOT" && pnpm build 2>&1)

# Extract sizes from Vite's output line, e.g.:
# dist/eddy-editor.js  37.90 kB │ gzip: 9.19 kB │ map: 130.46 kB
SIZE_LINE=$(echo "$BUILD_OUTPUT" | grep 'eddy-editor.js')
MIN_SIZE=$(echo "$SIZE_LINE" | awk '{print $2, $3}')
GZIP_SIZE=$(echo "$SIZE_LINE" | sed -E 's/.*gzip:[[:space:]]*([0-9]+\.[0-9]+ kB).*/\1/')

if [ -z "$MIN_SIZE" ] || [ -z "$GZIP_SIZE" ]; then
  echo "Could not extract bundle sizes from build output"
  exit 1
fi

# Patch the marker in README.md
sed -i '' "s|<!-- BUNDLE_SIZE -->.*<!-- /BUNDLE_SIZE -->|<!-- BUNDLE_SIZE -->**${MIN_SIZE}** min / **${GZIP_SIZE}** gzip<!-- /BUNDLE_SIZE -->|" "$README"

echo "Updated README.md: ${MIN_SIZE} min / ${GZIP_SIZE} gzip"
