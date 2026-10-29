// cpu_now.js [samples] [settleSecs] : sample CPU of the currently loaded patch
const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function targets() { return new Promise((res, rej) => { http.get('http://localhost:9222/json', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
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

  const realClick = async sel => {
    const b = await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return JSON.stringify([r.x+r.width/2,r.y+r.height/2])})()`);
    if (!b) return false;
    const [x, y] = JSON.parse(b);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    return true;
  };

  const samples = parseInt(process.argv[2] || '6');
  const settle = parseFloat(process.argv[3] || '10');
  let playing = false;
  for (let k = 0; k < 6; k++) {
    const st = await js('document.querySelector("button.play")?.getAttribute("aria-label")');
    if (st === 'Play') { await realClick('button.play'); await sleep(2000); }
    if (await js('document.querySelector("button.play")?.getAttribute("aria-label")') === 'Stop') { playing = true; break; }
  }
  await sleep(settle * 1000);
  const out = [];
  for (let i = 0; i < samples; i++) {
    out.push(JSON.parse(await js(`(()=>{const t=document.body.innerText;const p=t.match(/PEAK\\s+([0-9.]+)/);const c=t.match(/CPU[^\\n]*/);return JSON.stringify({peak:p?p[1]:null,cpu:c?c[0].replace(/\\s+/g,' '):null})})()`)));
    await sleep(1800);
  }
  console.log(JSON.stringify({ playing, out }, null, 1));
  ws.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1) });
