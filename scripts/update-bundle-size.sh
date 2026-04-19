#!/bin/sh
# Builds the library and patches the BUNDLE_SIZE marker in README.md
# with the actual transfer size (entry + shared chunks) for each framework.
# Each chunk is gzipped independently — same as a browser would fetch them.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
README="$ROOT/README.md"
DIST="$ROOT/dist"

# Build fresh dist
(cd "$ROOT" && pnpm build >/dev/null 2>&1)

if [ ! -f "$DIST/vue.js" ] || [ ! -f "$DIST/react.js" ]; then
  echo "Expected dist/vue.js and dist/react.js after build"
  exit 1
fi

# All *.js files in dist/ that are not framework entries count as shared chunks
# (both eddy-editor/vue and eddy-editor/react statically import them).
entry_files="index.js vue.js react.js"
shared_chunks=""
for f in "$DIST"/*.js; do
  base="$(basename "$f")"
  is_entry=0
  for e in $entry_files; do
    [ "$base" = "$e" ] && is_entry=1
  done
  [ "$is_entry" = "0" ] && shared_chunks="$shared_chunks $f"
done

sum_min() {
  total=0
  for f in "$@"; do
    [ -f "$f" ] && total=$((total + $(wc -c < "$f")))
  done
  echo "$total"
}

sum_gzip() {
  total=0
  for f in "$@"; do
    [ -f "$f" ] && total=$((total + $(gzip -9 -c "$f" | wc -c)))
  done
  echo "$total"
}

format_kb() {
  awk -v b="$1" 'BEGIN { printf "%.2f kB", b/1000 }'
}

VUE_MIN=$(format_kb "$(sum_min "$DIST/vue.js" $shared_chunks)")
VUE_GZIP=$(format_kb "$(sum_gzip "$DIST/vue.js" $shared_chunks)")
REACT_MIN=$(format_kb "$(sum_min "$DIST/react.js" $shared_chunks)")
REACT_GZIP=$(format_kb "$(sum_gzip "$DIST/react.js" $shared_chunks)")

REPLACEMENT="Vue **${VUE_MIN}** min / **${VUE_GZIP}** gzip · React **${REACT_MIN}** min / **${REACT_GZIP}** gzip"

sed -i '' "s|<!-- BUNDLE_SIZE -->.*<!-- /BUNDLE_SIZE -->|<!-- BUNDLE_SIZE -->${REPLACEMENT}<!-- /BUNDLE_SIZE -->|" "$README"

echo "Updated README.md:"
echo "  Vue:   ${VUE_MIN} min / ${VUE_GZIP} gzip"
echo "  React: ${REACT_MIN} min / ${REACT_GZIP} gzip"
