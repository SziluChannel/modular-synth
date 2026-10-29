const fs=require('fs'),http=require('http');
function getTargets(){return new Promise((res,rej)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
(async()=>{const ts=await getTargets();const p=ts.find(t=>t.type==='page'&&t.url.includes('circuit.synthcity.org'));const ws=new WebSocket(p.webSocketDebuggerUrl);let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};await new Promise(r=>ws.onopen=r);const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
const expr=`(()=>{
 const c=document.querySelector('canvas.scope');
 const ctx=c.getContext('2d');
 const w=c.width,h=c.height;
 const d=ctx.getImageData(0,0,w,h).data;
 let pts=[];
 for(let x=0;x<w;x++){
   let ys=[];
   for(let y=0;y<h;y++){
     const i=(y*w+x)*4;
     const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
     // cyan-ish trace: high g,b low r
     if(a>100 && g>120 && b>120 && r<120) ys.push(y);
   }
   if(ys.length){ pts.push([x, ys.reduce((a,b)=>a+b,0)/ys.length]); }
 }
 if(pts.length<10) return {w,h,n:pts.length};
 const ys=pts.map(p=>p[1]);
 const mean=ys.reduce((a,b)=>a+b,0)/ys.length;
 let zc=0; let last=ys[0]-mean;
 for(const y of ys){const d2=y-mean; if(last<0&&d2>=0) zc++; last=d2;}
 const spanX=pts[pts.length-1][0]-pts[0][0];
 return {w,h,n:pts.length,mean:Math.round(mean),minY:Math.round(Math.min(...ys)),maxY:Math.round(Math.max(...ys)),zc,spanX};
})()`;
const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});console.log(JSON.stringify(r.result.result.value));ws.close()})()
