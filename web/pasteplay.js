// pasteplay.js <netlist> : paste a netlist, press play, dump console/errors
const fs = require('fs'), http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function targets() { return new Promise((res, rej) => { http.get('http://localhost:9222/json', r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))) }).on('error', rej) }) }
(async () => {
  const ts = await targets();
  const page = ts.find(t => t.type === 'page' && t.url.includes('circuit.synthcity.org'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const logs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push('console.' + m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Log.entryAdded') logs.push('LOG[' + m.params.entry.level + ']: ' + m.params.entry.text);
  };
  await new Promise(r => ws.onopen = r);
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })) });
  const js = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value ?? null };
  await send('Runtime.enable'); await send('Log.enable');
  const content = fs.readFileSync(process.argv[2], 'utf8');
  if (await js('document.querySelectorAll(".cm-content").length') !== 1) {
    await js(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.innerText.trim()==="Netlist");if(b)b.click();return 1})()`);
    await sleep(1200);
  }
  await js(`(()=>{const v=document.querySelector('.cm-content').cmTile.view;v.dispatch({changes:{from:0,to:v.state.doc.length,insert:${JSON.stringify(content)}}});return v.state.doc.length})()`);
  await sleep(2500);
  await js(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.innerText.trim()==="Netlist");if(b)b.click();return 1})()`);
  await sleep(1200);
  const b = await js(`(()=>{const e=document.querySelector("button.play");const r=e.getBoundingClientRect();return JSON.stringify([r.x+r.width/2,r.y+r.height/2])})()`);
  const [x, y] = JSON.parse(b);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(5000);
  console.log('STATE', await js('document.body.innerText.replace(/\\n+/g," | ").slice(-260)'));
  console.log('--- logs ---'); console.log(logs.slice(-40).join('\n') || '(none)');
  ws.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1) });
