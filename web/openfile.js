// openfile.js <path> : load a netlist through the site's file input
const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function g() { return new Promise((res, rej) => { http.get('http://localhost:9222/json', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
(async () => {
  const ts = await g();
  const p = ts.find(t => t.type === 'page' && t.url.includes('circuit.synthcity.org'));
  const ws = new WebSocket(p.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } };
  await new Promise(r => ws.onopen = r);
  const send = (m, pr = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: pr })) });
  const doc = await send('DOM.getDocument', { depth: -1 });
  const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file][accept*=".cir"]' });
  if (!q.result.nodeId) { console.log('no file input'); process.exit(1) }
  await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [process.argv[2]] });
  await sleep(4000);
  const r = await send('Runtime.evaluate', { expression: 'document.body.innerText.replace(/\\n+/g," | ").slice(0,300)', returnByValue: true });
  console.log(r.result.result.value);
  ws.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1) });
