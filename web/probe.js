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
  const nodes=process.argv.slice(3);

  // ensure panel open
  const n=await evalJS('document.querySelectorAll(".cm-content").length');
  if(n!==1){ await evalJS(`(()=>{const b=Array.from(document.querySelectorAll("button")).find(x=>x.innerText.trim()==="Netlist"); if(b)b.click(); return 1})()`); await new Promise(r=>setTimeout(r,1200)); }

  for(const node of nodes){
    const content=base.replace(/^;@output .*$/gm, ';@output '+node);
    const expr=`(()=>{const v=document.querySelector('.cm-content').cmTile.view; v.dispatch({changes:{from:0,to:v.state.doc.length,insert:${JSON.stringify(content)}}}); return v.state.doc.length;})()`;
    await evalJS(expr);
    await new Promise(r=>setTimeout(r,2500));
    // make sure audio is actually running
    for(let k=0;k<4;k++){
      const st=await evalJS('document.querySelector("button.play")?.getAttribute("aria-label")');
      if(st==='Play'){ await evalJS('document.querySelector("button.play").click();1'); await new Promise(r=>setTimeout(r,1500)); }
      else break;
    }
    await new Promise(r=>setTimeout(r,2500));
    // make sure the scope is expanded so PEAK renders
    const hasPeak=await evalJS('/PEAK\\s+[0-9]/.test(document.body.innerText)');
    if(!hasPeak){
      const c=await evalJS('(()=>{const cv=document.querySelector("canvas");if(!cv)return null;const r=cv.getBoundingClientRect();return JSON.stringify([r.x+r.width/2,r.y+r.height*0.86,r.width,r.height])})()');
      if(c){const [x,y]=JSON.parse(c);
        for(const dy of [0,0,-30]){
          await evalJS(`(()=>{const cv=document.querySelector("canvas");cv.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:${x},clientY:${y+dy}}));return 1})()`);
          await new Promise(r=>setTimeout(r,900));
          if(await evalJS('/PEAK\\s+[0-9]/.test(document.body.innerText)')) break;
        }
      }
    }
    const txt=await evalJS('(()=>{const t=document.body.innerText;const m=t.match(/PEAK\\s+([0-9.]+)/);const c=t.match(/CPU[^\\n]*/);const k=/Output clipping/.test(t);return JSON.stringify({peak:m?m[1]:null,cpu:c?c[0]:null,clip:k});})()');
    console.log(node, txt);
  }
  ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
