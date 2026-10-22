#!/bin/sh
# Stamps css/js links in index.html with the current commit count so phones don't serve stale files.
v=$(git rev-list --count HEAD)
sed -i -E "s#css/app\.css(\?v=[0-9]+)?#css/app.css?v=$v#; s#js/app\.js(\?v=[0-9]+)?#js/app.js?v=$v#" index.html
echo "stamped v=$v"
