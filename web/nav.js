const http=require('http');
function g(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
(async()=>{const ts=await g();const p=ts.find(t=>t.type==='page'&&t.url.includes('circuit.synthcity.org'));const ws=new WebSocket(p.webSocketDebuggerUrl);let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};await new Promise(r=>ws.onopen=r);const send=(m,pr={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:pr}))});
await send('Page.navigate',{url:process.argv[2]});
await new Promise(r=>setTimeout(r,6000));
const t=await send('Runtime.evaluate',{expression:'JSON.stringify([...document.querySelectorAll("a")].map(a=>[a.innerText.trim().slice(0,60),a.getAttribute("href")]).filter(x=>x[1]))',returnByValue:true});
console.log(t.result.result.value);
ws.close()})()
