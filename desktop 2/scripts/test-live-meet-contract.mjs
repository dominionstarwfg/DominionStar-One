import assert from 'node:assert/strict';

const port = Number(process.env.DOMINIONSTAR_CDP_PORT || 9222);
const endpoint = `http://127.0.0.1:${port}`;
const deadline = Date.now() + 30000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPageTarget() {
  const response = await fetch(`${endpoint}/json/list`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`CDP target list returned ${response.status}`);
  const targets = await response.json();
  return targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl) || null;
}

async function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('CDP websocket open timeout')), 5000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('CDP websocket error'));
    }, { once: true });
  });
}

async function evaluate(socket, expression) {
  const id = Math.floor(Math.random() * 1_000_000_000);
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP Runtime.evaluate timeout')), 5000);
    const onMessage = event => {
      const message = JSON.parse(String(event.data || '{}'));
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.removeEventListener('message', onMessage);
      resolve(message);
    };
    socket.addEventListener('message', onMessage);
    socket.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true }
    }));
  });
  if (result.error) throw new Error(result.error.message || 'CDP evaluate failed');
  if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || 'Renderer evaluation failed');
  return result.result?.result?.value;
}

let target = null;
while (Date.now() < deadline && !target) {
  try { target = await getPageTarget(); } catch {}
  if (!target) await sleep(250);
}
assert.ok(target, 'DominionStar renderer never exposed a CDP page target');

const socket = await connect(target.webSocketDebuggerUrl);
let snapshot = null;
try {
  while (Date.now() < deadline) {
    snapshot = await evaluate(socket, `
      (async()=>{
        const body=String(document.body?.innerText||'');
        let runtime=null,contract=null,error='';
        try{
          runtime=await window.dominionDesktop?.getRuntimeInfo?.();
          const response=await fetch('/meet/release-contract.json',{cache:'no-store'});
          contract=response.ok?await response.json():null;
        }catch(err){error=String(err?.message||err);}
        return {href:String(location.href),body,runtime,contract,error};
      })()
    `);

    if (snapshot?.body?.includes('Desktop update required')) break;
    if (snapshot?.runtime?.meetReleaseId && snapshot?.contract?.releaseId) break;
    await sleep(300);
  }
} finally {
  socket.close();
}

assert.ok(snapshot, 'No live Meet renderer snapshot was captured');
console.log('LIVE_MEET_ACCEPTANCE', JSON.stringify({
  href: snapshot.href,
  bodyPreview: String(snapshot.body || '').slice(0, 240),
  runtime: snapshot.runtime,
  contract: snapshot.contract,
  error: snapshot.error
}));

assert.ok(!String(snapshot.body || '').includes('Desktop update required'), 'Live Meet rendered the false Desktop update required blocker');
assert.ok(snapshot.runtime, `Desktop runtime info unavailable: ${snapshot.error || 'unknown error'}`);
assert.ok(snapshot.contract?.releaseId, 'Live release contract did not expose releaseId');
assert.equal(snapshot.runtime.meetReleaseId, snapshot.contract.releaseId, 'Native runtime meetReleaseId does not match the live Meet contract');
assert.equal(snapshot.runtime.meetReleaseCompatible, true, 'Native runtime did not mark the live Meet release compatible');
assert.ok(Number(snapshot.runtime.bridgeVersion) >= Number(snapshot.contract.desktopBridge || 0), 'Native bridge is below the live Meet minimum');
console.log(`Live Meet desktop contract acceptance passed: releaseId=${snapshot.contract.releaseId} bridge=${snapshot.runtime.bridgeVersion}/${snapshot.contract.desktopBridge}`);
