const http=require('http');
function g(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
(async()=>{const ts=await g();const p=ts.find(t=>t.type==='page'&&t.url.includes('circuit.synthcity.org'));const ws=new WebSocket(p.webSocketDebuggerUrl);let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};await new Promise(r=>ws.onopen=r);const send=(m,pr={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:pr}))});
const r=await send('Runtime.evaluate',{expression:`(()=>{const ms=[...document.querySelectorAll('.cm-lint-marker')];return JSON.stringify(ms.map(m=>{const b=m.getBoundingClientRect();return {cls:m.className,x:b.x+b.width/2,y:b.y+b.height/2}}))})()`,returnByValue:true});
const marks=JSON.parse(r.result.result.value);
console.log('markers',marks.length);
for(const m of marks){
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:m.x,y:m.y});
  await new Promise(r=>setTimeout(r,900));
  const t=await send('Runtime.evaluate',{expression:`(()=>{const els=[...document.querySelectorAll('.cm-tooltip,.cm-tooltip-lint,[role=tooltip]')];return JSON.stringify(els.map(e=>e.innerText))})()`,returnByValue:true});
  console.log(m.cls, '->', t.result.result.value);
}
ws.close()})()
