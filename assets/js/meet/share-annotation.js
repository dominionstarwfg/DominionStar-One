(() => {
  'use strict';
  if (window.DominionShareAnnotation) return;

  const engine = window.DominionStarMeetingEngine;
  const stage = document.getElementById('stage');
  const video = document.getElementById('stageVideo');
  const menu = document.getElementById('deviceMenu');
  const viewerMore = document.getElementById('shareViewerMoreBtn');
  const presenterMore = document.getElementById('shareMoreBtn');
  if (!engine || !stage || !video || !menu) return;

  const MAX_STROKES = 220;
  const MAX_POINTS_PER_STROKE = 1200;
  const POINT_SEND_INTERVAL_MS = 28;
  const LASER_TTL_MS = 900;
  const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0));
  const randomId = prefix => `${prefix}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

  const state = {
    enabled: false,
    tool: 'pen',
    activeStrokeId: '',
    activePointerId: null,
    lastPointSentAt: 0,
    strokes: new Map(),
    order: [],
    laserNodes: new Map(),
    laserTimers: new Map(),
    members: new Map(),
    client: null,
    channel: null,
    channelRoomId: '',
    channelReady: false,
    channelPromise: null,
    renderQueued: false,
    canvas: null,
    toolbar: null,
    ctx: null,
    resizeObserver: null
  };

  const style = document.createElement('style');
  style.textContent = `
    .ds-annotation-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:42;pointer-events:none;touch-action:none;cursor:crosshair}
    .ds-annotation-canvas.is-active{pointer-events:auto}
    .ds-annotation-toolbar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:58;display:flex;align-items:center;gap:6px;padding:7px;border:1px solid rgba(255,255,255,.16);border-radius:16px;background:rgba(10,15,24,.88);box-shadow:0 16px 50px rgba(0,0,0,.42);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
    .ds-annotation-toolbar[hidden]{display:none!important}
    .ds-annotation-toolbar button{appearance:none;border:0;border-radius:10px;background:transparent;color:#f8fafc;font:700 12px/1.1 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:9px 10px;cursor:pointer;white-space:nowrap}
    .ds-annotation-toolbar button:hover{background:rgba(255,255,255,.10)}
    .ds-annotation-toolbar button[aria-pressed="true"]{background:rgba(232,188,73,.20);box-shadow:inset 0 0 0 1px rgba(232,188,73,.55)}
    .ds-annotation-toolbar .ds-annotation-danger{color:#ff8c8c}
    .ds-annotation-laser{position:absolute;z-index:57;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:999px;background:#ff405c;box-shadow:0 0 0 4px rgba(255,64,92,.20),0 0 22px rgba(255,64,92,.75);pointer-events:none;transition:left .04s linear,top .04s linear,opacity .16s ease}
    .ds-share-annotation-action{font-weight:700}
  `;
  document.head.append(style);

  const snapshot = () => engine.snapshot?.() || {};
  const isPrivileged = snap => Boolean(snap?.isHost || snap?.role === 'host' || snap?.role === 'cohost');

  const contentRect = () => {
    const sr = stage.getBoundingClientRect();
    const vr = video.getBoundingClientRect();
    const vw = Number(video.videoWidth || 0);
    const vh = Number(video.videoHeight || 0);
    if (!vw || !vh || !vr.width || !vr.height) {
      return {left:vr.left-sr.left,top:vr.top-sr.top,width:Math.max(1,vr.width),height:Math.max(1,vr.height)};
    }
    const scale = Math.min(vr.width / vw, vr.height / vh);
    const width = vw * scale;
    const height = vh * scale;
    return {
      left: vr.left - sr.left + (vr.width - width) / 2,
      top: vr.top - sr.top + (vr.height - height) / 2,
      width,
      height
    };
  };

  const normalizedPointFromEvent = event => {
    const sr = stage.getBoundingClientRect();
    const rect = contentRect();
    const x = event.clientX - sr.left;
    const y = event.clientY - sr.top;
    if (x < rect.left || y < rect.top || x > rect.left + rect.width || y > rect.top + rect.height) return null;
    return {x:clamp01((x-rect.left)/Math.max(1,rect.width)), y:clamp01((y-rect.top)/Math.max(1,rect.height))};
  };

  const pointToPixels = point => {
    const rect = contentRect();
    return {x:rect.left + clamp01(point.x)*rect.width, y:rect.top + clamp01(point.y)*rect.height};
  };

  const ensureCanvas = () => {
    if (state.canvas?.isConnected) return state.canvas;
    if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
    const canvas = document.createElement('canvas');
    canvas.className = 'ds-annotation-canvas';
    canvas.setAttribute('aria-label','Shared screen annotation surface');
    stage.append(canvas);
    state.canvas = canvas;
    state.ctx = canvas.getContext('2d');

    const toolbar = document.createElement('div');
    toolbar.className = 'ds-annotation-toolbar';
    toolbar.hidden = true;
    toolbar.setAttribute('role','toolbar');
    toolbar.setAttribute('aria-label','Annotation tools');
    const addTool = (label, tool) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.annotationTool = tool;
      button.setAttribute('aria-pressed', String(state.tool === tool));
      button.onclick = () => setTool(tool);
      toolbar.append(button);
    };
    addTool('Pen','pen');
    addTool('Highlighter','highlighter');
    addTool('Laser','laser');

    const undo = document.createElement('button');
    undo.type = 'button';
    undo.textContent = 'Undo';
    undo.onclick = undoOwnStroke;
    toolbar.append(undo);

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.dataset.annotationClear = '1';
    clear.onclick = clearAnnotations;
    toolbar.append(clear);

    const done = document.createElement('button');
    done.type = 'button';
    done.textContent = 'Done';
    done.onclick = closeAnnotation;
    toolbar.append(done);
    stage.append(toolbar);
    state.toolbar = toolbar;

    const resize = () => {
      const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.round(stage.clientWidth * ratio));
      const height = Math.max(1, Math.round(stage.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      canvas.style.width = `${stage.clientWidth}px`;
      canvas.style.height = `${stage.clientHeight}px`;
      state.ctx?.setTransform(ratio,0,0,ratio,0,0);
      scheduleRender();
    };
    state.resizeObserver = new ResizeObserver(resize);
    state.resizeObserver.observe(stage);
    video.addEventListener('loadedmetadata', resize);
    window.addEventListener('resize', resize, {passive:true});
    resize();

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    return canvas;
  };

  const renderStroke = stroke => {
    const ctx = state.ctx;
    if (!ctx || !stroke?.points?.length) return;
    const points = stroke.points.map(pointToPixels);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (stroke.tool === 'highlighter') {
      ctx.strokeStyle = 'rgba(255,214,74,.34)';
      ctx.lineWidth = 16;
    } else {
      ctx.strokeStyle = '#e8bc49';
      ctx.lineWidth = 3.2;
    }
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x,points[0].y,Math.max(2,ctx.lineWidth/2),0,Math.PI*2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0].x,points[0].y);
      for (let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const renderAll = () => {
    state.renderQueued = false;
    const ctx = state.ctx;
    if (!ctx || !state.canvas) return;
    ctx.clearRect(0,0,stage.clientWidth,stage.clientHeight);
    state.order.forEach(id => renderStroke(state.strokes.get(id)));
  };

  const scheduleRender = () => {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(renderAll);
  };

  const trimHistory = () => {
    while (state.order.length > MAX_STROKES) {
      const id = state.order.shift();
      state.strokes.delete(id);
    }
  };

  const addStroke = stroke => {
    if (!stroke?.id || state.strokes.has(stroke.id)) return;
    state.strokes.set(stroke.id, stroke);
    state.order.push(stroke.id);
    trimHistory();
    scheduleRender();
  };

  const removeStroke = id => {
    if (!id) return;
    state.strokes.delete(id);
    state.order = state.order.filter(item => item !== id);
    scheduleRender();
  };

  const clearOwner = owner => {
    if (!owner) return;
    state.order = state.order.filter(id => {
      const stroke = state.strokes.get(id);
      if (stroke?.owner === owner) { state.strokes.delete(id); return false; }
      return true;
    });
    scheduleRender();
  };

  const clearLocalState = () => {
    state.strokes.clear();
    state.order = [];
    state.laserNodes.forEach(node=>node.remove());
    state.laserNodes.clear();
    state.laserTimers.forEach(timer=>clearTimeout(timer));
    state.laserTimers.clear();
    scheduleRender();
  };

  const updateClearLabel = () => {
    const button = state.toolbar?.querySelector('[data-annotation-clear]');
    if (!button) return;
    button.textContent = isPrivileged(snapshot()) ? 'Clear All' : 'Clear Mine';
    button.classList.toggle('ds-annotation-danger', isPrivileged(snapshot()));
  };

  const setTool = tool => {
    state.tool = ['pen','highlighter','laser'].includes(tool) ? tool : 'pen';
    state.toolbar?.querySelectorAll('[data-annotation-tool]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.annotationTool===state.tool)));
    if (state.canvas) state.canvas.style.cursor = state.tool === 'laser' ? 'none' : 'crosshair';
  };

  const membersFromPresence = () => {
    const raw = state.channel?.presenceState?.() || {};
    const next = new Map();
    Object.values(raw).flat().forEach(member => {
      if (member?.participantId) next.set(String(member.participantId), member);
    });
    state.members = next;
  };

  const validRemoteSender = payload => {
    const snap = snapshot();
    if (!payload?.from || String(payload.roomId||'') !== String(snap.roomId||'')) return null;
    const member = state.members.get(String(payload.from));
    if (!member || member.admitted === false) return null;
    return member;
  };

  const showLaser = (owner, point) => {
    if (!owner || !point) return;
    ensureCanvas();
    let node = state.laserNodes.get(owner);
    if (!node) {
      node = document.createElement('div');
      node.className = 'ds-annotation-laser';
      stage.append(node);
      state.laserNodes.set(owner,node);
    }
    const pixel = pointToPixels(point);
    node.style.left = `${pixel.x}px`;
    node.style.top = `${pixel.y}px`;
    node.style.opacity = '1';
    clearTimeout(state.laserTimers.get(owner));
    state.laserTimers.set(owner,setTimeout(()=>{
      node.style.opacity = '0';
      setTimeout(()=>{node.remove();state.laserNodes.delete(owner);},180);
    },LASER_TTL_MS));
  };

  const hideLaser = owner => {
    const node = state.laserNodes.get(owner);
    if (!node) return;
    clearTimeout(state.laserTimers.get(owner));
    node.remove();
    state.laserNodes.delete(owner);
    state.laserTimers.delete(owner);
  };

  const handleRemote = payload => {
    const member = validRemoteSender(payload);
    if (!member) return;
    const type = String(payload.type||'');
    if (type === 'stroke-start') {
      const point = {x:clamp01(payload.x),y:clamp01(payload.y)};
      addStroke({id:String(payload.strokeId||''),owner:String(payload.from),tool:payload.tool==='highlighter'?'highlighter':'pen',points:[point]});
      return;
    }
    if (type === 'stroke-point') {
      const stroke = state.strokes.get(String(payload.strokeId||''));
      if (!stroke || stroke.owner !== String(payload.from) || stroke.points.length >= MAX_POINTS_PER_STROKE) return;
      stroke.points.push({x:clamp01(payload.x),y:clamp01(payload.y)});
      scheduleRender();
      return;
    }
    if (type === 'undo') { removeStroke(String(payload.strokeId||'')); return; }
    if (type === 'clear-owner') { clearOwner(String(payload.owner||payload.from)); return; }
    if (type === 'clear-all') {
      const privileged = Boolean(member.isHost || member.role === 'host' || member.role === 'cohost');
      if (privileged) clearLocalState();
      return;
    }
    if (type === 'laser') { showLaser(String(payload.from),{x:clamp01(payload.x),y:clamp01(payload.y)}); return; }
    if (type === 'laser-end') hideLaser(String(payload.from));
  };

  const createCleanClient = () => {
    const cfg = window.DOMINIONSTAR_SUPABASE || {};
    if (!window.supabase?.createClient || !cfg.url || !cfg.anonKey) return null;
    try {
      return window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    } catch (_) { return null; }
  };

  const ensureChannel = async () => {
    const snap = snapshot();
    if (!snap.roomId || !snap.participantId || !snap.admitted) return false;
    if (state.channelReady && state.channelRoomId === snap.roomId) return true;
    if (state.channelPromise && state.channelRoomId === snap.roomId) return state.channelPromise;

    if (state.channel && state.client) {
      try { await state.client.removeChannel(state.channel); } catch (_) {}
    }
    state.channel = null;
    state.channelReady = false;
    state.channelRoomId = String(snap.roomId);
    state.client = createCleanClient();
    if (!state.client) return false;

    state.channelPromise = new Promise(resolve => {
      let settled = false;
      const finish = value => { if (!settled) { settled=true; resolve(value); } };
      const timeout = setTimeout(()=>finish(false),5000);
      const channel = state.client.channel(`dominionstar-meet-annotation-${snap.roomId}`,{config:{broadcast:{self:false,ack:true},presence:{key:snap.participantId}}});
      state.channel = channel;
      channel.on('broadcast',{event:'meet-annotation'},({payload})=>handleRemote(payload));
      channel.on('presence',{event:'sync'},membersFromPresence);
      channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          state.channelReady = true;
          try {
            await channel.track({participantId:snap.participantId,displayName:snap.displayName||'',isHost:Boolean(snap.isHost),role:snap.role||'attendee',admitted:Boolean(snap.admitted),joinedAt:new Date().toISOString()});
          } catch (_) {}
          membersFromPresence();
          clearTimeout(timeout);
          finish(true);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          state.channelReady = false;
          clearTimeout(timeout);
          finish(false);
        }
      });
    }).finally(()=>{state.channelPromise=null;});
    return state.channelPromise;
  };

  const publish = async payload => {
    const snap = snapshot();
    if (!await ensureChannel()) return false;
    return state.channel.send({type:'broadcast',event:'meet-annotation',payload:{...payload,roomId:snap.roomId,from:snap.participantId,displayName:snap.displayName||'',isHost:Boolean(snap.isHost),role:snap.role||'attendee',admitted:Boolean(snap.admitted),sentAt:Date.now()}});
  };

  const onPointerDown = event => {
    if (!state.enabled || event.button > 0) return;
    const point = normalizedPointFromEvent(event);
    if (!point) return;
    state.activePointerId = event.pointerId;
    state.canvas?.setPointerCapture?.(event.pointerId);
    if (state.tool === 'laser') {
      const owner = String(snapshot().participantId||'self');
      showLaser(owner,point);
      publish({type:'laser',x:point.x,y:point.y});
      event.preventDefault();
      return;
    }
    const snap = snapshot();
    const id = randomId('ann');
    state.activeStrokeId = id;
    addStroke({id,owner:String(snap.participantId||'self'),tool:state.tool,points:[point]});
    publish({type:'stroke-start',strokeId:id,tool:state.tool,x:point.x,y:point.y});
    event.preventDefault();
  };

  const onPointerMove = event => {
    if (!state.enabled || state.activePointerId !== event.pointerId) return;
    const point = normalizedPointFromEvent(event);
    if (!point) return;
    const now = performance.now?.() || Date.now();
    if (state.tool === 'laser') {
      const owner = String(snapshot().participantId||'self');
      showLaser(owner,point);
      if (now-state.lastPointSentAt >= POINT_SEND_INTERVAL_MS) {
        state.lastPointSentAt = now;
        publish({type:'laser',x:point.x,y:point.y});
      }
      return;
    }
    const stroke = state.strokes.get(state.activeStrokeId);
    if (!stroke || stroke.points.length >= MAX_POINTS_PER_STROKE) return;
    const last = stroke.points[stroke.points.length-1];
    if (Math.hypot(point.x-last.x,point.y-last.y) < .0012) return;
    stroke.points.push(point);
    scheduleRender();
    if (now-state.lastPointSentAt >= POINT_SEND_INTERVAL_MS) {
      state.lastPointSentAt = now;
      publish({type:'stroke-point',strokeId:stroke.id,x:point.x,y:point.y});
    }
  };

  const onPointerUp = event => {
    if (state.activePointerId !== event.pointerId) return;
    const point = normalizedPointFromEvent(event);
    if (state.tool === 'laser') {
      const owner = String(snapshot().participantId||'self');
      if (point) publish({type:'laser',x:point.x,y:point.y});
      publish({type:'laser-end'});
      hideLaser(owner);
    } else if (state.activeStrokeId) {
      const stroke = state.strokes.get(state.activeStrokeId);
      if (point && stroke && stroke.points.length < MAX_POINTS_PER_STROKE) {
        const last = stroke.points[stroke.points.length-1];
        if (Math.hypot(point.x-last.x,point.y-last.y) >= .0005) {
          stroke.points.push(point);
          publish({type:'stroke-point',strokeId:stroke.id,x:point.x,y:point.y});
        }
      }
      state.activeStrokeId = '';
    }
    state.activePointerId = null;
    try { state.canvas?.releasePointerCapture?.(event.pointerId); } catch (_) {}
    scheduleRender();
  };

  const undoOwnStroke = async () => {
    const owner = String(snapshot().participantId||'');
    const id = [...state.order].reverse().find(item=>state.strokes.get(item)?.owner===owner);
    if (!id) return;
    removeStroke(id);
    await publish({type:'undo',strokeId:id});
  };

  const clearAnnotations = async () => {
    const snap = snapshot();
    if (isPrivileged(snap)) {
      clearLocalState();
      await publish({type:'clear-all'});
      return;
    }
    clearOwner(String(snap.participantId||''));
    await publish({type:'clear-owner',owner:String(snap.participantId||'')});
  };

  const openAnnotation = async () => {
    if (!document.body.classList.contains('presentation-active')) return false;
    if (!await ensureChannel()) return false;
    ensureCanvas();
    state.enabled = true;
    state.canvas.classList.add('is-active');
    state.toolbar.hidden = false;
    updateClearLabel();
    setTool(state.tool);
    return true;
  };

  const closeAnnotation = () => {
    state.enabled = false;
    state.activePointerId = null;
    state.activeStrokeId = '';
    state.canvas?.classList.remove('is-active');
    if (state.toolbar) state.toolbar.hidden = true;
    hideLaser(String(snapshot().participantId||'self'));
  };

  const addMenuAction = (body, label, action) => {
    if (body.querySelector('[data-ds-annotation-action="1"]')) return;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'device-menu-item ds-share-view-action ds-share-annotation-action';
    item.dataset.dsAnnotationAction = '1';
    item.setAttribute('role','menuitem');
    item.innerHTML = `<span class="ds-share-view-check" aria-hidden="true"></span><span>${label}</span>`;
    item.onclick = async event => {
      event.preventDefault();
      event.stopPropagation();
      await action();
      menu.hidden = true;
    };
    body.append(item);
  };

  const enhanceMenu = () => {
    const title = menu.querySelector('.menu-title')?.textContent?.trim();
    const body = menu.querySelector('.utility-menu-body') || menu;
    if (title === 'Shared Screen') addMenuAction(body,'Annotate',openAnnotation);
    if (title === 'More' && document.body.classList.contains('local-presentation-active')) addMenuAction(body,'Annotate',openAnnotation);
  };

  const wrapMenuButton = button => {
    if (!button || button.dataset.dsAnnotationWrapped === '1' || typeof button.onclick !== 'function') return;
    button.dataset.dsAnnotationWrapped = '1';
    const original = button.onclick;
    button.onclick = event => {
      original.call(button,event);
      queueMicrotask(enhanceMenu);
    };
  };

  wrapMenuButton(viewerMore);
  wrapMenuButton(presenterMore);
  new MutationObserver(()=>{ if (!menu.hidden) enhanceMenu(); }).observe(menu,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});

  engine.on?.('admitted',()=>ensureChannel());
  engine.on?.('connected',()=>ensureChannel());
  engine.on?.('screen-ended',()=>{closeAnnotation();clearLocalState();});
  engine.on?.('screen-state',payload=>{
    if (payload?.active === false) { closeAnnotation(); clearLocalState(); }
  });

  window.DominionShareAnnotation = Object.freeze({
    version:'1.0.0',
    open:openAnnotation,
    close:closeAnnotation,
    setTool,
    clear:clearAnnotations,
    snapshot:()=>({enabled:state.enabled,tool:state.tool,strokes:state.order.length,channelReady:state.channelReady,roomId:state.channelRoomId})
  });
})();
