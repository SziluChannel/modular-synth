const http=require('http');
function g(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
(async()=>{
  const ts=await g();
  const p=ts.find(t=>t.type==='page'&&t.url.includes('circuit.synthcity.org'));
  const ws=new WebSocket(p.webSocketDebuggerUrl);
  let id=0; const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
  await new Promise(r=>ws.onopen=r);
  const send=(m,pr={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:pr}))});
  const w=parseInt(process.argv[2]||'1500'), h=parseInt(process.argv[3]||'950');
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
  const r=await send('Runtime.evaluate',{expression:'JSON.stringify({win:[innerWidth,innerHeight],play:(()=>{const e=document.querySelector("button.play");if(!e)return null;const b=e.getBoundingClientRect();return [b.x,b.y,b.width,b.height]})()})',returnByValue:true});
  console.log(r.result.result.value);
  ws.close();
})();
