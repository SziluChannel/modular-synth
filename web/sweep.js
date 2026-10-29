const fs=require('fs'), http=require('http');
function getTargets(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
(async()=>{
  const targets=await getTargets();
  const page=targets.find(t=>t.type==='page'&&t.url.includes('circuit.synthcity.org'));
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending=new Map();
  ws.onmessage=ev=>{const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
  await new Promise(r=>ws.onopen=r);
  const send=(method,params={})=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
  const evalJS=async(expr)=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});return r.result?.result?.value??r.result};
  const base=fs.readFileSync(process.argv[2],'utf8');
  const pairs=process.argv.slice(3); // name=value
  for(const p of pairs){
    const [k,v]=p.split('=');
    const content=base.replace(new RegExp('(\\.param\\s+'+k+'\\s*=\\s*)[^\\n\\s]+'), '$1'+v);
    await evalJS(`(()=>{const v=document.querySelector('.cm-content').cmTile.view; v.dispatch({changes:{from:0,to:v.state.doc.length,insert:${JSON.stringify(content)}}}); return 1})()`);
    await new Promise(r=>setTimeout(r,3500));
    const t=await evalJS(`(()=>{const t=document.body.innerText;const m=t.match(/PEAK\\s+([0-9.]+)/);const c=t.match(/CPU[^\\n]*/);return JSON.stringify({peak:m?m[1]:null,cpu:c?c[0]:null})})()`);
    console.log(k+'='+v, t);
  }
  ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
