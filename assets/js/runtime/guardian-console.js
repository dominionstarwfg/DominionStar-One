(()=>{
'use strict';
if(window.DominionGuardianConsole)return;
const ENABLE_QUERY=new URLSearchParams(location.search).get('guardian')==='1';
let root=null, open=ENABLE_QUERY, renderTimer=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const formatMs=value=>value<1000?`${Math.round(value)} ms`:`${(value/1000).toFixed(1)} s`;

const ensure=()=>{
  if(root)return root;
  root=document.createElement('aside');
  root.id='dominionGuardianConsole';
  root.setAttribute('aria-label','DominionStar engineering diagnostics');
  root.innerHTML='<div class="dg-head"><strong>Guardian</strong><span class="dg-status">—</span><button type="button" class="dg-certify" aria-label="Run production gate">Gate</button><button type="button" class="dg-export" aria-label="Export diagnostics">Export</button><button type="button" class="dg-close" aria-label="Close Guardian">×</button></div><div class="dg-body"></div>';
  const style=document.createElement('style');
  style.textContent=`
#dominionGuardianConsole{position:fixed;right:16px;bottom:84px;width:min(430px,calc(100vw - 32px));max-height:min(640px,calc(100vh - 120px));overflow:hidden;z-index:2147483000;background:rgba(12,14,18,.96);color:#f4f6f8;border:1px solid rgba(255,255,255,.15);border-radius:14px;box-shadow:0 22px 60px rgba(0,0,0,.48);font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;backdrop-filter:blur(18px)}
#dominionGuardianConsole[hidden]{display:none}.dg-head{display:flex;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1)}.dg-head strong{font:600 13px/1.2 system-ui,sans-serif}.dg-head .dg-status{margin-left:auto;text-transform:uppercase;font-size:10px;letter-spacing:.08em}.dg-head button{border:0;background:transparent;color:inherit;cursor:pointer}.dg-head .dg-export,.dg-head .dg-certify{font:600 11px/1.2 system-ui,sans-serif;padding:5px 8px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:rgba(255,255,255,.06)}.dg-head .dg-close{font-size:20px}.dg-body{padding:10px 12px;overflow:auto;max-height:560px}.dg-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dg-card{padding:8px 9px;border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(255,255,255,.035)}.dg-card b{display:block;font:600 11px/1.25 system-ui,sans-serif;margin-bottom:4px}.dg-row{display:flex;justify-content:space-between;gap:12px}.dg-alert{padding:7px 0;border-bottom:1px solid rgba(255,255,255,.07)}.dg-alert:last-child{border:0}.dg-warning{color:#ffd166}.dg-error,.dg-critical{color:#ff6b6b}.dg-healthy{color:#69db7c}.dg-muted{color:#aeb5bf}`;
  document.head.appendChild(style); document.body.appendChild(root);
  root.querySelector('.dg-close').addEventListener('click',()=>toggle(false));
  root.querySelector('.dg-export').addEventListener('click',()=>window.DominionGuardianResilience?.exportDiagnostics?.());
  root.querySelector('.dg-certify').addEventListener('click',()=>{const report=window.DominionGuardianCertification?.run?.(); if(report) render();});
  return root;
};

const render=()=>{
  if(!open)return;
  const guardian=window.DominionGuardianObserver; if(!guardian)return;
  const el=ensure(); const snap=guardian.snapshot(); const h=snap.health||{};
  el.querySelector('.dg-status').className=`dg-status dg-${esc(h.status||'unknown')}`;
  el.querySelector('.dg-status').textContent=h.status||'unknown';
  const services=Object.entries(h.services||{}).map(([name,item])=>`<div class="dg-card"><b>${esc(name)}</b><div class="dg-row"><span>Status</span><span class="dg-${esc(item?.status||'unknown')}">${esc(item?.status||'unknown')}</span></div>${item?.peerCount!==undefined?`<div class="dg-row"><span>Peers</span><span>${esc(item.peerCount)}</span></div>`:''}${item?.pendingModerationRequests!==undefined?`<div class="dg-row"><span>Pending controls</span><span>${esc(item.pendingModerationRequests)}</span></div>`:''}${item?.successes!==undefined?`<div class="dg-row"><span>Recoveries</span><span>${esc(item.successes)}</span></div>`:''}${item?.failures!==undefined?`<div class="dg-row"><span>Recovery failures</span><span>${esc(item.failures)}</span></div>`:''}${item?.inFlight!==undefined?`<div class="dg-row"><span>In flight</span><span>${esc(item.inFlight)}</span></div>`:''}${item?.eventLoopLagMs!==undefined?`<div class="dg-row"><span>Event-loop lag</span><span>${esc(item.eventLoopLagMs)} ms</span></div>`:''}${item?.longTasks!==undefined?`<div class="dg-row"><span>Long tasks</span><span>${esc(item.longTasks)}</span></div>`:''}${item?.recentErrors!==undefined?`<div class="dg-row"><span>Recent errors</span><span>${esc(item.recentErrors)}</span></div>`:''}${item?.memoryRatio!==undefined&&item?.memoryRatio!==null?`<div class="dg-row"><span>Heap</span><span>${esc(Math.round(item.memoryRatio*100))}%</span></div>`:''}</div>`).join('');
  const cert=window.DominionGuardianCertification?.snapshot?.();
  const certCard=cert?`<div class="dg-card"><b>Production gate</b><div class="dg-row"><span>Status</span><span class="dg-${cert.status==='pass'?'healthy':cert.status==='warn'?'warning':'error'}">${esc(cert.status)}</span></div><div class="dg-row"><span>Checks</span><span>${esc(cert.summary?.pass||0)} pass / ${esc(cert.summary?.warn||0)} warn / ${esc(cert.summary?.fail||0)} fail</span></div><div class="dg-row"><span>Stable</span><span>${formatMs(cert.stability?.healthyForMs||0)} / ${formatMs(cert.stability?.targetMs||0)}</span></div><div class="dg-row"><span>Ready</span><span>${cert.productionReady?'YES':'not yet'}</span></div></div>`:'';
  const alerts=snap.alerts.slice(-8).reverse().map(item=>`<div class="dg-alert"><div class="dg-row"><span class="dg-${esc(item.severity)}">${esc(item.severity)}</span><span class="dg-muted">${new Date(item.timestamp).toLocaleTimeString()}</span></div><div>${esc(item.type)}</div></div>`).join('')||'<div class="dg-muted">No recent alerts.</div>';
  el.querySelector('.dg-body').innerHTML=`<div class="dg-grid"><div class="dg-card"><b>Runtime</b><div class="dg-row"><span>Events/sec</span><span>${esc(h.eventRatePerSecond)}</span></div><div class="dg-row"><span>Observed</span><span>${esc(h.eventsObserved)}</span></div><div class="dg-row"><span>Online</span><span>${h.online?'yes':'no'}</span></div><div class="dg-row"><span>Uptime</span><span>${formatMs(h.uptimeMs||0)}</span></div></div><div class="dg-card"><b>Alerts</b><div class="dg-row"><span>Total</span><span>${esc(h.alerts)}</span></div><div class="dg-row"><span>Last 60s</span><span>${esc(h.recentWarnings)}</span></div><div class="dg-row"><span>Visibility</span><span>${esc(h.visibility)}</span></div></div>${services}${certCard}</div><div style="height:10px"></div><b style="font-family:system-ui,sans-serif">Recent alerts</b>${alerts}`;
};

const toggle=value=>{
  open=value===undefined?!open:Boolean(value);
  const el=ensure(); el.hidden=!open;
  clearInterval(renderTimer); renderTimer=null;
  if(open){render();renderTimer=setInterval(render,1000);}
  return open;
};

document.addEventListener('keydown',event=>{
  if(event.ctrlKey&&event.shiftKey&&event.key.toLowerCase()==='g'){event.preventDefault();toggle();}
});
window.addEventListener('dominion:guardian-snapshot',()=>{if(open)render();});
window.DominionGuardianConsole={toggle,open:()=>toggle(true),close:()=>toggle(false),render};
if(ENABLE_QUERY)document.addEventListener('DOMContentLoaded',()=>toggle(true),{once:true});
})();
