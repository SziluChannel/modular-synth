// Silences the page: routes every AudioNode connection to ctx.destination
// through a zero-gain node. Persists across reloads until the browser restarts.
const http=require('http');
function g(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const SRC=`(()=>{
  if(window.__csMute) return;
  window.__csMute=true;
  const orig=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(dest,...rest){
    try{
      const ctx=this.context;
      if(dest && ctx && dest===ctx.destination){
        if(!window.__csMuteGain || window.__csMuteGain.context!==ctx){
          const gn=ctx.createGain(); gn.gain.value=0; window.__csMuteGain=gn;
          orig.call(gn,dest);
        }
        return orig.call(this,window.__csMuteGain,...rest);
      }
    }catch(e){}
    return orig.call(this,dest,...rest);
  };
})();`;
(async()=>{
  const ts=await g();
  const p=ts.find(t=>t.type==='page'&&t.url.includes('circuit.synthcity.org'));
  const ws=new WebSocket(p.webSocketDebuggerUrl);
  let id=0; const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
  await new Promise(r=>ws.onopen=r);
  const send=(m,pr={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:pr}))});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:SRC});
  // apply to the already-loaded document too
  await send('Runtime.evaluate',{expression:SRC});
  const r=await send('Runtime.evaluate',{expression:'JSON.stringify({mute:!!window.__csMute})',returnByValue:true});
  console.log(r.result.result.value);
  ws.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
