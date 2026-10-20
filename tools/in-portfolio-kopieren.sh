#!/bin/bash
# Kopiert die laufende Seite ins Portfolio: ./tools/in-portfolio-kopieren.sh [Portfolio-Ordner]
# Standard: ../PortfolioWebseiteCloudflare (neben diesem Projekt). Kopiert wird nur, was die
# Seite zum Laufen braucht (index.html, style.css, js/, lib/, data/) – ohne data/_voll,
# tools/, screenshots/ und Plandateien. Danach im Portfolio committen und pushen.
set -e
HIER="$(cd "$(dirname "$0")/.." && pwd)"
ZIEL_ROOT="${1:-$HIER/../PortfolioWebseiteCloudflare}"
ZIEL="$ZIEL_ROOT/projekte/landfall"

[ -d "$ZIEL_ROOT/projekte" ] || { echo "Portfolio nicht gefunden: $ZIEL_ROOT" >&2; exit 1; }

rm -rf "$ZIEL"
mkdir -p "$ZIEL"
cp "$HIER/index.html" "$HIER/style.css" "$ZIEL/"
cp -r "$HIER/js" "$HIER/lib" "$ZIEL/"
mkdir -p "$ZIEL/data"
for f in "$HIER"/data/*.js; do cp "$f" "$ZIEL/data/"; done

echo "Kopiert nach: $ZIEL"
echo "Dateien: $(find "$ZIEL" -type f | wc -l), Größe: $(du -sh "$ZIEL" | cut -f1)"
echo "Als Nächstes im Portfolio: git add projekte/landfall && git commit && git push"
