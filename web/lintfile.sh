#!/bin/bash
node openfile.js "$1" >/dev/null 2>&1
sleep 2
node cdp.js eval 'document.querySelectorAll(".cm-content").length' >/dev/null
open=$(node cdp.js eval 'document.querySelectorAll(".cm-content").length')
if [ "$open" = "0" ]; then node cdp.js eval '(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.innerText.trim()==="Netlist");if(b)b.click();return 1})()' >/dev/null; sleep 2; fi
node cdp.js eval '(()=>{const m=[...document.querySelectorAll("span.msg")].map(e=>e.textContent.trim());return JSON.stringify({panel:document.querySelectorAll(".cm-content").length,n:m.length,u:[...new Set(m)].slice(0,4)})})()'
