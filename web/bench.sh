#!/bin/bash
# bench.sh <file> : reload, load netlist, start audio, let it settle, report
cd "$(dirname "$0")"
F="$1"
node reload.js >/dev/null
sleep 9
# open netlist panel
n=$(node cdp.js eval 'document.querySelectorAll(".cm-content").length' 2>/dev/null | tr -d '"')
if [ "$n" != "1" ]; then
  node cdp.js eval '(()=>{const b=Array.from(document.querySelectorAll("button")).find(x=>x.innerText.trim()==="Netlist"); if(b)b.click(); return 1})()' >/dev/null
  sleep 1
fi
node cdp_paste.js "$F" >/dev/null
sleep 3
# close panel
node cdp.js eval '(()=>{const b=Array.from(document.querySelectorAll("button")).find(x=>x.innerText.trim()==="Netlist"); if(b)b.click(); return 1})()' >/dev/null
sleep 1
# start audio
for k in 1 2 3; do
  st=$(node cdp.js eval 'document.querySelector("button.play")?.getAttribute("aria-label")' | tr -d '"')
  if [ "$st" = "Play" ]; then node cdp.js eval 'document.querySelector("button.play").click();1' >/dev/null; sleep 1; else break; fi
done
sleep 2
# expand scope (toggle until PEAK is on screen)
node clickscope.js >/dev/null 2>&1
sleep 2
if ! node cdp.js text | grep -q PEAK; then node clickscope.js >/dev/null 2>&1; sleep 2; fi
if ! node cdp.js text | grep -q PEAK; then node clickscope.js >/dev/null 2>&1; sleep 2; fi
sleep 10
for i in 1 2 3; do
  node cdp.js text | grep -oE "CPU [0-9.]+%|CPU OVERLOAD · [0-9]+%|PEAK [0-9.]+" | tr '\n' ' '
  echo
  sleep 2
done
