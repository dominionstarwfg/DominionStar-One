(()=>{
  if(window.DominionMeetDiagnostics)return;
  const desktop=window.dominionDesktop||{};
  const q=s=>document.querySelector(s);
  const now=()=>new Date().toISOString();
  const clean=value=>JSON.parse(JSON.stringify(value??null,(key,val)=>/token|credential|secret|authorization/i.test(key)?'[redacted]':val));

  function ensureUi(){
    if(q('#meetDiagnosticsButton'))return;
    const button=document.createElement('button');button.id='meetDiagnosticsButton';button.type='button';button.className='meet-diagnostics-button';button.textContent='Diagnostics';button.hidden=true;document.body.append(button);
    const panel=document.createElement('section');panel.id='meetDiagnosticsPanel';panel.className='meet-diagnostics-panel';panel.hidden=true;panel.innerHTML=`<header><div><strong>Meeting diagnostics</strong><small>Physical QA status</small></div><button type="button" data-diag-close>×</button></header><div id="meetDiagnosticsSummary" class="meet-diagnostics-summary"></div><pre id="meetDiagnosticsReport"></pre><footer><button type="button" data-diag-refresh>Refresh</button><button type="button" data-diag-copy>Copy diagnostics</button></footer>`;document.body.append(panel);
    button.onclick=()=>{panel.hidden=false;void refresh();};
    panel.querySelector('[data-diag-close]').onclick=()=>{panel.hidden=true;};
    panel.querySelector('[data-diag-refresh]').onclick=()=>void refresh();
    panel.querySelector('[data-diag-copy]').onclick=async()=>{const text=q('#meetDiagnosticsReport')?.textContent||'';try{await navigator.clipboard.writeText(text);panel.querySelector('[data-diag-copy]').textContent='Copied';setTimeout(()=>{const b=panel.querySelector('[data-diag-copy]');if(b)b.textContent='Copy diagnostics';},1500);}catch{}};
  }

  async function collect(){
    const auth=await desktop.auth?.getState?.().catch(error=>({error:String(error?.message||error)}));
    const room=await desktop.meeting?.context?.().catch(error=>({error:String(error?.message||error)}));
    const media=window.DominionMediaController?.snapshot?.()||null;
    const share=window.DominionShareController?.snapshot?.()||null;
    const transport=window.DominionWebRTCController?.snapshot?.()||null;
    const badge=q('#transportStatus');
    return clean({
      generatedAt:now(),
      app:{desktop:Boolean(desktop.isDesktop),userAgent:navigator.userAgent,platform:navigator.platform},
      auth,
      room,
      media,
      share,
      transport,
      transportBadge:badge?{text:badge.textContent||'',kind:badge.dataset.kind||''}:null,
      visibility:{meetingOpen:Boolean(q('#meetingOverlay')&&!q('#meetingOverlay').hidden),waitingOpen:Boolean(q('#waitingOverlay')&&!q('#waitingOverlay').hidden),prejoinOpen:Boolean(q('#prejoinOverlay')&&!q('#prejoinOverlay').hidden)}
    });
  }

  async function refresh(){
    ensureUi();const report=await collect();const summary=q('#meetDiagnosticsSummary');const text=q('#meetDiagnosticsReport');
    const transport=report.transport||{};const media=report.media||{};const share=report.share||{};
    if(summary)summary.innerHTML=`<span>Peers <strong>${Number(transport.peerCount)||0}</strong></span><span>Camera <strong>${media.videoLive?'Live':'Off'}</strong></span><span>Mic <strong>${media.audioLive?'Live':'Muted'}</strong></span><span>Share <strong>${share.active?'Live':'Off'}</strong></span>`;
    if(text)text.textContent=JSON.stringify(report,null,2);return report;
  }

  function syncVisibility(){ensureUi();const button=q('#meetDiagnosticsButton');if(button)button.hidden=!q('#meetingOverlay')||q('#meetingOverlay').hidden;}
  setInterval(syncVisibility,500);ensureUi();syncVisibility();
  window.DominionMeetDiagnostics=Object.freeze({collect,refresh});
})();
