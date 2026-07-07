#!/bin/bash
# Syncs the built lib/ to the example's yalc and node_modules copies.
# Yarn runs this automatically after `yarn prepare` via the `postprepare` hook.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for target in \
  "example/node_modules/react-native-mapsforge-vtm-ext-path-color-ramp" \
  "example/.yalc/react-native-mapsforge-vtm-ext-path-color-ramp"
do
  if [ -d "$ROOT/$target" ]; then
    rm -rf "$ROOT/$target/lib"
    cp -r "$ROOT/lib" "$ROOT/$target/lib"
    echo "Synced lib/ → $target"
  fi
done
