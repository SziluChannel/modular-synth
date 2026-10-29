#!/bin/bash
# Usage: ./paste.sh <netlist-file> [waitsecs]
set -e
cd "$(dirname "$0")"
FILE="$1"
WAIT="${2:-4}"
n=$(node cdp.js eval 'document.querySelectorAll(".cm-content").length' 2>/dev/null | tr -d '"')
if [ "$n" != "1" ]; then
  node cdp.js eval '(()=>{const b=Array.from(document.querySelectorAll("button")).find(x=>x.innerText.trim()==="Netlist"); if(b)b.click(); return "clicked";})()' >/dev/null
  sleep 1
fi
node cdp_paste.js "$FILE"
sleep "$WAIT"
node cdp.js text | grep -E "PEAK|CPU|error|Error|singular|unsupported|duplicate|clipping" | head -8
