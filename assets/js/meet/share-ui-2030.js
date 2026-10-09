(() => {
  'use strict';
  if (window.DominionShareUI2030) return;

  const style = document.createElement('style');
  style.dataset.dsShareUi2030 = '1';
  style.textContent = `
    /* Operation 2030 — compact native-feeling presentation controls */
    .share-status-bar{
      top:12px!important;
      min-height:52px!important;
      max-width:min(980px,calc(100vw - 28px))!important;
      gap:8px!important;
      padding:6px!important;
      border:1px solid rgba(255,255,255,.14)!important;
      border-radius:17px!important;
      background:linear-gradient(180deg,rgba(22,27,35,.92),rgba(9,13,19,.94))!important;
      box-shadow:0 18px 54px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.07)!important;
      -webkit-backdrop-filter:blur(26px) saturate(145%)!important;
      backdrop-filter:blur(26px) saturate(145%)!important;
    }
    .share-status-copy{
      position:relative!important;
      min-height:38px!important;
      padding:0 12px 0 29px!important;
      gap:8px!important;
      border:1px solid rgba(72,225,131,.18)!important;
      border-radius:11px!important;
      background:rgba(39,181,96,.09)!important;
      color:#eefcf3!important;
      font-size:11px!important;
      letter-spacing:.01em!important;
    }
    .share-status-copy::before{
      content:'';
      position:absolute;
      left:10px;
      top:50%;
      width:8px;
      height:14px;
      transform:translateY(-50%);
      opacity:.55;
      background:radial-gradient(circle,#d8e0e9 1.3px,transparent 1.5px) 0 0/4px 5px;
    }
    .share-live-dot{width:7px!important;height:7px!important;background:#38dc7e!important;box-shadow:0 0 0 3px rgba(56,220,126,.14),0 0 16px rgba(56,220,126,.35)!important}
    .share-viewer-more{
      width:40px!important;height:40px!important;border-radius:11px!important;
      border:1px solid rgba(255,255,255,.08)!important;
      background:rgba(255,255,255,.055)!important;
    }
    .share-viewer-more:hover{background:rgba(255,255,255,.11)!important}
    .share-presenter-controls{gap:3px!important;align-items:center!important}
    .share-presenter-controls button{
      min-width:48px!important;height:40px!important;padding:3px 8px!important;
      border:1px solid transparent!important;border-radius:10px!important;
      background:transparent!important;color:#f3f6fa!important;
      transition:background .14s ease,border-color .14s ease,transform .14s ease!important;
    }
    .share-presenter-controls button:hover{background:rgba(255,255,255,.075)!important;border-color:rgba(255,255,255,.08)!important;transform:translateY(-1px)!important}
    .share-presenter-controls button:active{transform:translateY(0)!important}
    .share-presenter-controls button svg{width:16px!important;height:16px!important;stroke-width:1.8!important}
    .share-presenter-controls button small{font-size:8.5px!important;font-weight:650!important;letter-spacing:.01em!important;color:#cbd4df!important}
    #pauseShareBtn,#newShareBtn{
      display:flex!important;align-items:center!important;justify-content:center!important;
      min-width:auto!important;padding:0 13px!important;font-size:10px!important;font-weight:760!important;
      border-color:rgba(255,255,255,.08)!important;background:rgba(255,255,255,.045)!important;
    }
    #pauseShareBtn{color:#f4d67c!important}
    #newShareBtn{color:#dbeafe!important}
    .share-presenter-controls .stop-share{
      display:flex!important;align-items:center!important;justify-content:center!important;
      min-width:auto!important;padding:0 14px!important;
      border-color:rgba(255,102,112,.36)!important;
      background:linear-gradient(180deg,#e34d59,#c72e3b)!important;
      color:white!important;font-size:10px!important;font-weight:800!important;
      box-shadow:0 6px 18px rgba(199,46,59,.22)!important;
    }
    .share-presenter-controls .stop-share:hover{background:linear-gradient(180deg,#ef5c67,#d73744)!important;border-color:rgba(255,128,136,.5)!important}

    /* Desktop share picker — restrained, native-style source chooser */
    #desktopSharePicker{
      width:min(1010px,92vw)!important;height:min(690px,86vh)!important;
      border:1px solid rgba(255,255,255,.13)!important;border-radius:22px!important;
      background:linear-gradient(160deg,rgba(20,27,38,.98),rgba(7,11,17,.99) 68%)!important;
      box-shadow:0 38px 120px rgba(0,0,0,.68),inset 0 1px 0 rgba(255,255,255,.07)!important;
      overflow:hidden!important;user-select:none!important;
    }
    #desktopSharePicker::backdrop{background:rgba(2,5,10,.78)!important;-webkit-backdrop-filter:blur(16px)!important;backdrop-filter:blur(16px)!important}
    #desktopSharePicker header{padding:18px 20px!important;background:transparent!important;border-bottom:1px solid rgba(255,255,255,.08)!important}
    #desktopSharePicker header>button{width:34px!important;height:34px!important;border-radius:10px!important;background:rgba(255,255,255,.055)!important;font-size:20px!important;cursor:pointer!important}
    #desktopSharePicker header>button:hover{background:rgba(255,255,255,.1)!important}
    .ds-share-brand{gap:12px!important}.ds-share-brand img{width:40px!important;height:40px!important;border-radius:11px!important;box-shadow:0 0 0 1px rgba(232,188,73,.25)!important}
    .ds-share-brand b{color:#e9c45d!important;font-size:9px!important;letter-spacing:.18em!important}.ds-share-brand strong{font-size:18px!important}.ds-share-brand small{margin-top:3px!important;color:#97a5b7!important}
    #desktopSharePicker nav{
      width:max-content!important;margin:14px 20px 4px!important;padding:4px!important;gap:3px!important;
      border:1px solid rgba(255,255,255,.08)!important;border-radius:12px!important;background:rgba(255,255,255,.04)!important;
    }
    #desktopSharePicker nav button{padding:8px 13px!important;border:0!important;border-radius:8px!important;color:#9eabbc!important;font-size:11px!important;font-weight:700!important;cursor:pointer!important}
    #desktopSharePicker nav button.active{background:rgba(255,255,255,.1)!important;color:#f8fafc!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)!important}
    #desktopSharePicker main{grid-template-columns:minmax(0,1fr) 244px!important;gap:14px!important;padding:12px 18px 14px!important}
    .ds-share-content{border:1px solid rgba(255,255,255,.065)!important;border-radius:16px!important;background:rgba(255,255,255,.018)!important;scrollbar-width:thin!important}
    .ds-share-sources{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:13px!important;padding:15px!important}
    .ds-share-source{
      position:relative!important;padding:6px!important;border:1px solid rgba(255,255,255,.085)!important;border-radius:13px!important;
      background:rgba(255,255,255,.035)!important;box-shadow:none!important;transform:none!important;cursor:default!important;
      transition:border-color .14s ease,background .14s ease,box-shadow .14s ease!important;
    }
    .ds-share-source:hover{transform:none!important;background:rgba(255,255,255,.065)!important;border-color:rgba(255,255,255,.16)!important;box-shadow:none!important}
    .ds-share-source.selected{border-color:#e8bc49!important;background:rgba(232,188,73,.075)!important;box-shadow:0 0 0 2px rgba(232,188,73,.13)!important}
    .ds-share-source.selected::after{content:'✓';position:absolute;top:12px;right:12px;width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:#e8bc49;color:#171207;font-size:13px;font-weight:900;box-shadow:0 5px 16px rgba(0,0,0,.35)}
    .ds-share-source img{border-radius:8px!important;background:#030609!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.055)!important}
    .ds-share-source strong{padding:8px 3px 1px!important;font-size:12px!important;font-weight:720!important}.ds-share-source small{padding:0 3px 3px!important;color:#8795a8!important;font-size:10px!important}
    #desktopSharePicker aside{padding:16px!important;border:1px solid rgba(255,255,255,.07)!important;border-radius:16px!important;background:rgba(255,255,255,.025)!important;gap:10px!important}
    #desktopSharePicker aside>strong{padding:2px 2px 6px!important;color:#eef2f7!important;font-size:12px!important;letter-spacing:.01em!important}
    #desktopSharePicker aside label{padding:10px!important;border:1px solid rgba(255,255,255,.065)!important;border-radius:10px!important;background:rgba(255,255,255,.025)!important;font-size:11px!important;font-weight:650!important;cursor:pointer!important}
    #desktopSharePicker aside label:hover{background:rgba(255,255,255,.05)!important}
    #desktopSharePicker aside input{accent-color:#e8bc49!important}
    #desktopSharePicker aside p,#desktopSharePicker aside small{font-size:10px!important;color:#8492a5!important}
    .ds-share-permission{margin:22px!important;padding:36px!important;border-color:rgba(232,188,73,.22)!important;border-radius:15px!important;background:rgba(232,188,73,.035)!important;box-shadow:none!important}
    .ds-share-permission button{border-radius:10px!important;background:#e8bc49!important;box-shadow:none!important}
    #desktopSharePicker footer{padding:12px 18px!important;background:rgba(5,9,14,.7)!important;border-top:1px solid rgba(255,255,255,.075)!important}
    #desktopSharePicker footer span{color:#8f9daf!important;font-size:11px!important}
    #desktopSharePicker footer button{padding:9px 16px!important;border:1px solid rgba(255,255,255,.1)!important;border-radius:10px!important;background:rgba(255,255,255,.055)!important;font-size:11px!important;box-shadow:none!important}
    #desktopSharePicker footer .primary{background:#e8bc49!important;border-color:#e8bc49!important;color:#171207!important;box-shadow:none!important}
    #desktopSharePicker footer .primary:disabled{opacity:.28!important}
    #desktopSharePicker button:focus{outline:none!important}#desktopSharePicker button:focus-visible{outline:2px solid rgba(232,188,73,.85)!important;outline-offset:2px!important}

    @media(max-width:1100px){
      .share-status-copy{display:flex!important}
      .share-presenter-controls button{min-width:42px!important;padding:3px 6px!important}
      .share-presenter-controls button small{display:none!important}
      #pauseShareBtn,#newShareBtn,.share-presenter-controls .stop-share{padding:0 10px!important}
    }
    @media(max-width:820px){
      .share-status-bar{width:calc(100vw - 16px)!important;overflow-x:auto!important;justify-content:flex-start!important}
      .share-status-copy{display:none!important}.share-presenter-controls{margin:0!important}
      #desktopSharePicker main{grid-template-columns:1fr!important}#desktopSharePicker aside{display:none!important}.ds-share-sources{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    }
  `;
  document.head.append(style);

  window.DominionShareUI2030 = Object.freeze({
    version:'1.0.0',
    snapshot:()=>({
      toolbar:Boolean(document.getElementById('shareStatusBar')),
      picker:Boolean(document.getElementById('desktopSharePicker')),
      desktop:Boolean(window.dominionDesktop?.isDesktop)
    })
  });
})();
