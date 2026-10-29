const fs = require('fs');
const http = require('http');

function getTargets() {
  return new Promise((res, rej) => {
    http.get('http://localhost:9222/json', r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d)));
    }).on('error', rej);
  });
}

async function main() {
  const targets = await getTargets();
  const page = targets.find(t => t.type==='page' && t.url.includes('circuit.synthcity.org'));
  if (!page) throw new Error('no page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending=new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  await new Promise(r => ws.onopen = r);
  const send = (method, params={}) => new Promise(r => { const i=++id; pending.set(i,r); ws.send(JSON.stringify({id:i,method,params})); });
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', {expression: expr, returnByValue:true, awaitPromise:true});
    if (r.result?.exceptionDetails) return {error: r.result.exceptionDetails.text};
    return r.result?.result?.value ?? r.result;
  };
  const cmd = process.argv[2];
  if (cmd === 'eval') {
    console.log(JSON.stringify(await evalJS(process.argv[3]), null, 2));
  } else if (cmd === 'text') {
    console.log(await evalJS('document.body.innerText'));
  } else if (cmd === 'html') {
    console.log(await evalJS('document.body.innerHTML.slice(0,20000)'));
  } else if (cmd === 'paste') {
    const content = fs.readFileSync(process.argv[3], 'utf8');
    // focus editor
    await evalJS('document.querySelector(".cm-content").focus()');
    // select all
    await send('Input.dispatchKeyEvent', {type:'keyDown', key:'a', code:'KeyA', modifiers:2, windowsVirtualKeyCode:65});
    await send('Input.dispatchKeyEvent', {type:'keyUp', key:'a', code:'KeyA', modifiers:2, windowsVirtualKeyCode:65});
    // insert text
    const r = await send('Input.insertText', {text: content});
    console.log('inserted', content.length, 'chars');
  } else if (cmd === 'key') {
    const key = process.argv[3], code = process.argv[4] || key;
    await send('Input.dispatchKeyEvent', {type:'keyDown', key, code, windowsVirtualKeyCode: key.length===1 ? key.toUpperCase().charCodeAt(0) : 13});
    await send('Input.dispatchKeyEvent', {type:'keyUp', key, code});
    console.log('key', key);
  }
  ws.close();
}
main().catch(e=>{console.error(e); process.exit(1)});
