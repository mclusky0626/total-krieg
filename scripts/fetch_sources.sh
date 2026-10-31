#!/usr/bin/env bash
# Download the raw datasets used by the build scripts into .cache/src (≈260 MB).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .cache/src && cd .cache/src
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_10m_land ne_10m_lakes ne_10m_rivers_lake_centerlines_scale_rank ne_10m_rivers_europe \
         ne_10m_railroads ne_10m_admin_0_countries ne_10m_admin_1_states_provinces; do
  [ -f "$f.geojson" ] || curl -fsSL -o "$f.geojson" "$NE/$f.geojson"
done
[ -f CShapes-2.0.geojson ] || curl -fsSL -o CShapes-2.0.geojson https://icr.ethz.ch/data/cshapes/CShapes-2.0.geojson
[ -f cities1000.txt ] || { curl -fsSL -o cities1000.zip https://download.geonames.org/export/dump/cities1000.zip && unzip -oq cities1000.zip; }
[ -d ne1/NE1_50M_SR_W ] || { curl -fsSL -o NE1_50M_SR_W.zip https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR_W.zip && unzip -oq NE1_50M_SR_W.zip -d ne1; }
echo "sources ready in .cache/src"
