// measure.js <netlist-file> [samples] [settleSecs]
// Deterministic: paste -> close panel -> play -> expand scope -> sample.
const fs=require('fs'), http=require('http');
function targets(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const ts=await targets();
  const page=ts.find(t=>t.type==='page'&&t.url.includes('circuit.synthcity.org'));
  if(!page) throw new Error('no page target');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
  await new Promise(r=>ws.onopen=r);
  const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))});
  const js=async(expr)=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});return r.result?.result?.value??null};

  const file=process.argv[2];
  const samples=parseInt(process.argv[3]||'6');
  const settle=parseFloat(process.argv[4]||'8');
  const content=fs.readFileSync(file,'utf8');

  // 1. open netlist panel if closed
  if(await js('document.querySelectorAll(".cm-content").length')!==1){
    await js(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.innerText.trim()==="Netlist");if(b)b.click();return 1})()`);
    await sleep(1200);
  }
  // 2. paste
  await js(`(()=>{const v=document.querySelector('.cm-content').cmTile.view;v.dispatch({changes:{from:0,to:v.state.doc.length,insert:${JSON.stringify(content)}}});return v.state.doc.length})()`);
  await sleep(3000);
  // 3. close panel
  await js(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.innerText.trim()==="Netlist");if(b)b.click();return 1})()`);
  await sleep(1500);

  // 4. playing?
  const startPlaying=async()=>{
    for(let k=0;k<4;k++){
      const st=await js('document.querySelector("button.play")?.getAttribute("aria-label")');
      if(st==='Play'){ await js('document.querySelector("button.play").click();1'); await sleep(1500); } else return true;
    }
    return false;
  };
  await startPlaying();

  // 5. expand scope so PEAK renders
  const hasPeak=()=>js(`/PEAK\\s+[0-9]/.test(document.body.innerText)`);
  for(let k=0;k<3 && !(await hasPeak());k++){
    const b=await js(`(()=>{const c=document.querySelector("canvas.scope");if(!c)return null;const r=c.getBoundingClientRect();return JSON.stringify([r.x+r.width/2,r.y+r.height/2])})()`);
    if(!b) break;
    const [x,y]=JSON.parse(b);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
    await sleep(1500);
  }
  // scope toggle may have stopped the transport; re-check
  await startPlaying();

  await sleep(settle*1000);
  const out=[];
  for(let i=0;i<samples;i++){
    const v=await js(`(()=>{const t=document.body.innerText;const p=t.match(/PEAK\\s+([0-9.]+)/);const c=t.match(/CPU[^\\n]*/);return JSON.stringify({peak:p?p[1]:null,cpu:c?c[0].replace(/\\s+/g,' '):null,clip:/Output clipping/.test(t),over:/OVERLOAD/.test(t)})})()`);
    out.push(JSON.parse(v));
    await sleep(2000);
  }
  console.log(JSON.stringify({file,out}));
  ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
