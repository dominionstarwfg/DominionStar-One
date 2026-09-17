(()=>{
  if(window.DominionMoreMenuSemanticIcons)return;

  const icons=Object.freeze({
    'Record':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>',
    'Show captions':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10a2 2 0 1 0 0 4M18 10a2 2 0 1 0 0 4"/></svg>',
    'Breakout rooms':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    'Polls/quizzes':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7"/><path d="m4 6 2 2 4-4"/></svg>',
    'Docs':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>',
    'Whiteboards':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M8 12l3-3 2 2 3-3"/></svg>',
    'Apps':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    'Meeting info':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>',
    'Transfer to room':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h9v16H4zM13 12h8M18 9l3 3-3 3"/></svg>',
    'Settings':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.87 2.87-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21h-4v-.05A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06-2.87-2.87.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06L7.07 4.2l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.05A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.87 2.87-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.05A1.7 1.7 0 0 0 19.4 15z"/></svg>'
  });

  function installStyle(){
    if(document.querySelector('style[data-ds-more-semantic-icons]'))return;
    const style=document.createElement('style');
    style.dataset.dsMoreSemanticIcons='1';
    style.textContent=`
      .ds-ref-meeting-more-grid{
        width:264px!important;
        min-width:264px!important;
        max-width:calc(100vw - 24px)!important;
        box-sizing:border-box!important;
      }
      .ds-ref-meeting-more-grid .ds-ref-meeting-more-items{
        display:grid!important;
        grid-template-columns:repeat(3,minmax(72px,1fr))!important;
        column-gap:8px!important;
        row-gap:4px!important;
        padding:10px 10px 8px!important;
        box-sizing:border-box!important;
      }
      .ds-ref-meeting-more-grid .ds-ref-meeting-more-items button{
        min-width:0!important;
        min-height:62px!important;
        padding:6px 4px!important;
        box-sizing:border-box!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:flex-start!important;
        text-align:center!important;
        font-size:12px!important;
        line-height:1.15!important;
        white-space:normal!important;
        overflow-wrap:normal!important;
        word-break:normal!important;
      }
      .ds-ref-meeting-more-grid .ds-ref-more-icon{
        width:22px!important;
        height:22px!important;
        flex:0 0 22px!important;
        display:grid!important;
        place-items:center!important;
        margin:0 auto 5px!important;
        color:#f2f3f5!important;
        font-size:0!important;
        line-height:1!important;
      }
      .ds-ref-meeting-more-grid .ds-ref-more-icon svg{
        width:20px!important;
        height:20px!important;
        display:block!important;
        fill:none!important;
        stroke:currentColor!important;
        stroke-width:1.8!important;
        stroke-linecap:round!important;
        stroke-linejoin:round!important;
      }
      .ds-ref-meeting-more-grid button:disabled .ds-ref-more-icon{opacity:.58!important}
      .ds-ref-meeting-more-grid .ds-ref-meeting-more-footer{padding:8px 10px!important;box-sizing:border-box!important}
    `;
    document.head.append(style);
  }

  function apply(){
    installStyle();
    document.querySelectorAll('.ds-ref-meeting-more-items button').forEach(button=>{
      const label=[...button.children].find(node=>!node.classList?.contains('ds-ref-more-icon'))?.textContent?.trim()||'';
      const icon=button.querySelector('.ds-ref-more-icon');
      if(icon&&icons[label]&&icon.dataset.semanticIcon!=='1'){
        icon.innerHTML=icons[label];
        icon.dataset.semanticIcon='1';
      }
    });
  }

  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('click',event=>{if(event.target?.closest?.('#roomMore'))requestAnimationFrame(apply);},true);
  window.addEventListener('dominion:meeting-ui-ready',apply,true);
  window.DominionMoreMenuSemanticIcons=Object.freeze({apply,dispose:()=>observer.disconnect()});
  apply();
})();
