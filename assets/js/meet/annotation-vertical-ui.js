(() => {
  'use strict';
  if (window.DominionVerticalAnnotationUI) return;

  const ICONS = Object.freeze({
    Pen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
    Highlighter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 11 6 6"/><path d="m4 21 4-1 11-11a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="M13 19h8"/></svg>',
    Laser: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    Undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5"/><path d="M20 17a8 8 0 0 0-11-8H4"/></svg>',
    Clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M7 6l1 15h8l1-15M10 10v7M14 10v7"/></svg>',
    Done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
  });

  const style = document.createElement('style');
  style.textContent = `
    .ds-annotation-toolbar.ds-vertical-annotation-rail{
      position:absolute!important;left:18px!important;top:50%!important;bottom:auto!important;
      transform:translateY(-50%)!important;z-index:62!important;width:46px!important;
      display:flex!important;flex-direction:column!important;align-items:center!important;gap:5px!important;
      padding:7px 5px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:13px!important;
      background:rgba(8,13,21,.93)!important;box-shadow:0 18px 48px rgba(0,0,0,.45)!important;
      backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important
    }
    .ds-annotation-toolbar.ds-vertical-annotation-rail[hidden]{display:none!important}
    .ds-vertical-annotation-rail button{
      width:36px!important;height:36px!important;min-width:36px!important;padding:0!important;display:grid!important;
      place-items:center!important;border-radius:9px!important;color:#f8fafc!important;font-size:0!important;position:relative!important
    }
    .ds-vertical-annotation-rail button svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .ds-vertical-annotation-rail button:hover{background:rgba(255,255,255,.10)!important}
    .ds-vertical-annotation-rail button[aria-pressed="true"]{color:#e8bc49!important;background:rgba(232,188,73,.16)!important;box-shadow:inset 0 0 0 1px rgba(232,188,73,.48)!important}
    .ds-vertical-annotation-rail .ds-annotation-danger{color:#ff8585!important}
    .ds-vertical-annotation-rail button::after{
      content:attr(aria-label);position:absolute;left:47px;top:50%;transform:translateY(-50%) translateX(-4px);opacity:0;
      pointer-events:none;white-space:nowrap;padding:6px 8px;border-radius:7px;background:#0b111a;color:#f8fafc;
      border:1px solid rgba(255,255,255,.13);font:700 11px/1.1 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      box-shadow:0 8px 24px rgba(0,0,0,.35);transition:opacity .12s ease,transform .12s ease
    }
    .ds-vertical-annotation-rail button:hover::after{opacity:1;transform:translateY(-50%) translateX(0)}
    @media(max-width:760px){.ds-annotation-toolbar.ds-vertical-annotation-rail{left:10px!important;transform:translateY(-50%) scale(.92)!important;transform-origin:left center!important}}
  `;
  document.head.append(style);

  const decorateButton = button => {
    const text = String(button.textContent || '').trim();
    const previous = String(button.getAttribute('aria-label') || '').trim();
    const label = text || previous;
    let key = label;
    if (/^Clear/i.test(label)) key = 'Clear';
    if (!ICONS[key]) return;
    button.setAttribute('aria-label', label || key);
    button.setAttribute('title', label || key);
    if (!button.querySelector('svg') || text) button.innerHTML = ICONS[key];
  };

  const decorate = toolbar => {
    if (!toolbar) return false;
    toolbar.dataset.verticalUi = '1';
    toolbar.classList.add('ds-vertical-annotation-rail');
    toolbar.style.bottom = '';
    toolbar.style.left = '';
    toolbar.style.top = '';
    toolbar.style.transform = '';
    [...toolbar.querySelectorAll('button')].forEach(decorateButton);
    return true;
  };

  let refreshing = false;
  const refresh = () => {
    if (refreshing) return;
    refreshing = true;
    requestAnimationFrame(() => {
      refreshing = false;
      decorate(document.querySelector('.ds-annotation-toolbar'));
    });
  };

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  refresh();

  window.DominionVerticalAnnotationUI = Object.freeze({version:'1.1.0',refresh});
})();