// cpu.js <netlist> [samples] [settleSecs]
// Paste, mute, start transport, then sample the reported CPU load.
const fs = require('fs'), http = require('http');
function targets() { return new Promise((res, rej) => { http.get('http://localhost:9222/json', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MUTE = `(()=>{
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

(async () => {
  const ts = await targets();
  const page = ts.find(t => t.type === 'page' && t.url.includes('circuit.synthcity.org'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } };
  await new Promise(r => ws.onopen = r);
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })) });
  const js = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value ?? null };

  await send('Page.bringToFront', {});
  await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  await send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});

  const file = process.argv[2];
  const samples = parseInt(process.argv[3] || '8');
  const settle = parseFloat(process.argv[4] || '10');
  const content = fs.readFileSync(file, 'utf8');

  if (await js('document.querySelectorAll(".cm-content").length') !== 1) {
    await js(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.innerText.trim()==="Netlist");if(b)b.click();return 1})()`);
    await sleep(1200);
  }
  await js(`(()=>{const v=document.querySelector('.cm-content').cmTile.view;v.dispatch({changes:{from:0,to:v.state.doc.length,insert:${JSON.stringify(content)}}});return v.state.doc.length})()`);
  await sleep(2500);
  await js(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.innerText.trim()==="Netlist");if(b)b.click();return 1})()`);
  await sleep(1200);

  // audio is muted at the PipeWire sink level (audio.sh), not in-page

  const realClick = async sel => {
    const b = await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return JSON.stringify([r.x+r.width/2,r.y+r.height/2])})()`);
    if (!b) return false;
    const [x, y] = JSON.parse(b);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    return true;
  };
  let playing = false;
  for (let k = 0; k < 6; k++) {
    const st = await js('document.querySelector("button.play")?.getAttribute("aria-label")');
    if (st === 'Play') { await realClick('button.play'); await sleep(2000); }
    const now = await js('document.querySelector("button.play")?.getAttribute("aria-label")');
    if (now === 'Stop') { playing = true; break; }
  }
  const muted = 'os-level';
  await sleep(settle * 1000);

  const out = [];
  for (let i = 0; i < samples; i++) {
    out.push(await js(`(()=>{const t=document.body.innerText;const p=t.match(/PEAK\\s+([0-9.]+)/);const c=t.match(/CPU[^\\n]*/);return JSON.stringify({peak:p?p[1]:null,cpu:c?c[0].replace(/\\s+/g,' '):null,aria:document.querySelector("button.play")?.getAttribute("aria-label")})})()`));
    await sleep(1800);
  }
  console.log(JSON.stringify({ file: file.split('/').pop(), playing, muted, out: out.map(JSON.parse) }, null, 1));
  ws.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1) });
