#!/bin/bash
# fresh.sh : reload page, start audio, expand scope
cd "$(dirname "$0")"
node reload.js >/dev/null
sleep 9
node cdp.js eval 'document.querySelector("button.play")?.click(); "play"' >/dev/null
sleep 1
node clickscope.js >/dev/null
sleep 1
node cdp.js text | grep -E "PEAK|CPU" | head -3
