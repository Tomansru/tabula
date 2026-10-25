#!/bin/sh
# Builds dist/tabula-<version>.zip for the Chrome Web Store and GitHub releases.
# Only the files the extension loads go in: no lab/, docs/, tests or README.
set -eu
cd "$(dirname "$0")/.."

version=$(node -p "require('./manifest.json').version")
out="dist/tabula-$version.zip"

mkdir -p dist
rm -f "$out"
zip -r -X -q "$out" manifest.json newtab.html css js icons _locales -x '*.DS_Store'
echo "$out"
