const http=require('http');
function g(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
(async()=>{const ts=await g();const p=ts.find(t=>t.type==='page'&&t.url.includes('circuit.synthcity.org'));const ws=new WebSocket(p.webSocketDebuggerUrl);let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};await new Promise(r=>ws.onopen=r);const send=(m,pr={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:pr}))});
const r=await send('Runtime.evaluate',{expression:`(()=>{const e=document.querySelector('[data-testid="netlist-status"]');const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`,returnByValue:true});
const b=r.result.result.value;
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:b.x,y:b.y});
await new Promise(r=>setTimeout(r,1200));
const t=await send('Runtime.evaluate',{expression:`(()=>{const out=[];document.querySelectorAll('[role=tooltip],[class*=tooltip],[class*=popover],[data-base-ui-tooltip-content]').forEach(e=>out.push(e.innerText));return JSON.stringify(out)})()`,returnByValue:true});
console.log(t.result.result.value);
ws.close()})()
