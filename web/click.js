// click.js <css-selector>  -- real mouse click via CDP
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
  const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});return r.result?.result?.value};
  const b=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(process.argv[2])});if(!e)return null;const r=e.getBoundingClientRect();return JSON.stringify([r.x+r.width/2,r.y+r.height/2])})()`);
  if(!b){console.log('no element');process.exit(1)}
  const [x,y]=JSON.parse(b);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
  console.log('clicked',x,y);
  ws.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
