(()=>{
  'use strict';
  if(window.DominionRemoteAnnotation)return;
  const desktop=window.dominionDesktop||{},meeting=desktop.meeting||null;
  const q=s=>document.querySelector(s);
  const state={active:false,mode:'pen',color:'#ff3b30',drawing:false,points:[],canvas:null,ctx:null,toolbar:null,button:null,textEditor:null,policy:{enabled:false,showNames:true},policyAt:0,clearTimer:0};

  function remoteVideo(){const video=q('#remoteShareVideo');return video&&!video.hidden&&video.srcObject?video:null;}
  function stage(){return q('#meetingOverlay .stage')||q('.stage');}
  function ensureStyle(){
    if(q('style[data-ds-remote-annotation]'))return;
    const s=document.createElement('style');s.dataset.dsRemoteAnnotation='1';s.textContent=`
      .remote-annotation-button{position:absolute;left:16px;bottom:16px;z-index:88;height:38px;padding:0 13px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(18,23,30,.94);color:#f3f6fa;font:700 10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.32);cursor:pointer}
      .remote-annotation-button:hover{background:#252d37}.remote-annotation-button[hidden]{display:none!important}
      .remote-annotation-viewer{position:absolute;inset:0;z-index:86;pointer-events:none}.remote-annotation-viewer.active{pointer-events:auto;cursor:crosshair}.remote-annotation-viewer canvas{position:absolute;inset:0;width:100%;height:100%}
      .remote-annotation-toolbar{position:absolute;left:16px;bottom:62px;z-index:89;display:flex;align-items:center;gap:4px;padding:5px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(15,20,27,.96);box-shadow:0 14px 36px rgba(0,0,0,.38);pointer-events:auto}
      .remote-annotation-toolbar[hidden]{display:none!important}.remote-annotation-toolbar button{height:30px;padding:0 9px;border:0;border-radius:7px;background:transparent;color:#eef4fa;font-size:9px;font-weight:760;cursor:pointer}.remote-annotation-toolbar button:hover,.remote-annotation-toolbar button.active{background:rgba(45,140,255,.18);color:#92c5ff}
      .remote-annotation-colors{display:flex;align-items:center;gap:4px;padding:0 5px;border-left:1px solid rgba(255,255,255,.1);border-right:1px solid rgba(255,255,255,.1)}.remote-annotation-colors button{width:20px;height:20px;min-width:20px;padding:0;border-radius:50%;border:2px solid rgba(255,255,255,.2)}.remote-annotation-colors button.active{box-shadow:0 0 0 2px #111820,0 0 0 4px rgba(255,255,255,.72)}
      .remote-annotation-text{position:absolute;z-index:91;width:min(280px,40vw);min-height:62px;padding:8px 10px;border:1px solid #4f9cff;border-radius:7px;resize:both;background:rgba(9,14,21,.96);color:#fff;outline:none;font:600 14px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:auto}
    `;document.head.append(s);
  }

  function geometry(){
    const video=remoteVideo(),host=stage();if(!video||!host)return null;
    const vr=video.getBoundingClientRect(),sr=host.getBoundingClientRect(),vw=Math.max(1,Number(video.videoWidth)||vr.width),vh=Math.max(1,Number(video.videoHeight)||vr.height);
    const scale=Math.min(vr.width/vw,vr.height/vh),w=vw*scale,h=vh*scale;
    return {left:(vr.left-sr.left)+(vr.width-w)/2,top:(vr.top-sr.top)+(vr.height-h)/2,width:w,height:h,stageWidth:sr.width,stageHeight:sr.height};
  }
  function normalized(event){
    const g=geometry(),host=stage();if(!g||!host)return null;const sr=host.getBoundingClientRect(),x=event.clientX-sr.left-g.left,y=event.clientY-sr.top-g.top;
    if(x<0||y<0||x>g.width||y>g.height)return null;
    return {x:Math.max(0,Math.min(1,x/g.width)),y:Math.max(0,Math.min(1,y/g.height))};
  }
  function pixel(point){const g=geometry();if(!g||!point)return null;return {x:g.left+point.x*g.width,y:g.top+point.y*g.height};}
  function resize(){const host=stage(),canvas=state.canvas;if(!host||!canvas)return;const r=host.getBoundingClientRect(),dpr=Math.max(1,Math.min(2,devicePixelRatio||1)),w=Math.max(2,Math.round(r.width*dpr)),h=Math.max(2,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;state.ctx=canvas.getContext('2d');state.ctx.setTransform(dpr,0,0,dpr,0,0);}}
  function clearPreview(delay=0){clearTimeout(state.clearTimer);const run=()=>{if(state.ctx&&state.canvas)state.ctx.clearRect(0,0,state.canvas.width,state.canvas.height);};if(delay)state.clearTimer=setTimeout(run,delay);else run();}
  function drawSegment(a,b,mode=state.mode,color=state.color){
    const pa=pixel(a),pb=pixel(b);if(!pa||!pb||!state.ctx)return;
    const ctx=state.ctx;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation=mode==='erase'?'destination-out':'source-over';ctx.globalAlpha=mode==='highlight'?.34:1;ctx.strokeStyle=mode==='highlight'?'#ffe45e':color;ctx.lineWidth=mode==='highlight'?18:mode==='erase'?22:5;ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();ctx.restore();
  }
  async function policy(force=false){
    const now=Date.now();if(!force&&now-state.policyAt<1200)return state.policy;
    try{const ctx=await meeting?.context?.();if(!ctx?.roomId){state.policy={enabled:false,showNames:true};}
      else{const snap=await meeting.snapshot(ctx.roomId);state.policy={enabled:snap?.annotationEnabled!==false,showNames:snap?.annotationNamesVisible!==false};}
    }catch{state.policy={enabled:false,showNames:true};}
    state.policyAt=now;return state.policy;
  }
  async function send(type,payload){
    const video=remoteVideo(),target=String(video?.dataset.peerId||'');if(!target||!meeting?.sendSignal)return false;
    const p=await policy(true);if(!p.enabled){deactivate();return false;}
    try{await meeting.sendSignal(target,type,payload);return true;}catch{return false;}
  }

  function closeText({commit=false}={}){
    const editor=state.textEditor;state.textEditor=null;if(!editor)return;
    const point=editor.__point,text=String(editor.value||'').trimEnd();editor.remove();
    if(commit&&text&&point)void send('annotation:text',{text:text.slice(0,500),x:point.x,y:point.y,color:state.color,fontSize:26});
  }
  function openText(event){
    const point=normalized(event);if(!point)return;closeText({commit:true});
    const host=stage(),sr=host.getBoundingClientRect(),editor=document.createElement('textarea');editor.className='remote-annotation-text';editor.rows=2;editor.maxLength=500;editor.placeholder='Type text';editor.__point=point;editor.style.left=(event.clientX-sr.left)+'px';editor.style.top=(event.clientY-sr.top)+'px';host.append(editor);state.textEditor=editor;
    editor.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeText({commit:false});}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();closeText({commit:true});}});
    editor.addEventListener('blur',()=>{if(state.textEditor===editor)closeText({commit:true});},{once:true});queueMicrotask(()=>editor.focus());
  }
  function down(event){if(!state.active||event.button!==0)return;if(event.target.closest('.remote-annotation-toolbar'))return;if(state.mode==='text'){openText(event);event.preventDefault();return;}const p=normalized(event);if(!p)return;state.drawing=true;state.points=[p];state.canvas.setPointerCapture?.(event.pointerId);event.preventDefault();}
  function move(event){if(!state.drawing)return;const p=normalized(event);if(!p)return;const last=state.points[state.points.length-1];if(!last)return;const dx=p.x-last.x,dy=p.y-last.y;if(Math.hypot(dx,dy)<.002)return;state.points.push(p);if(state.points.length>240)state.points.splice(1,1);drawSegment(last,p);event.preventDefault();}
  function up(event){if(!state.drawing)return;state.drawing=false;state.canvas.releasePointerCapture?.(event.pointerId);const points=state.points.slice();state.points=[];if(points.length===1){const p={x:Math.min(1,points[0].x+.001),y:Math.min(1,points[0].y+.001)};drawSegment(points[0],p);points.push(p);}void send('annotation:stroke',{mode:state.mode,color:state.color,width:5,points}).then(ok=>{if(ok)clearPreview(900);});}

  function setMode(mode){closeText({commit:true});state.mode=mode;state.toolbar?.querySelectorAll('[data-remote-mode]').forEach(b=>b.classList.toggle('active',b.dataset.remoteMode===mode));}
  async function activate(){
    const p=await policy(true),video=remoteVideo();if(!p.enabled||!video)return false;ensure();state.active=true;state.canvas.parentElement.classList.add('active');state.toolbar.hidden=false;state.button.textContent='Done';resize();return true;
  }
  function deactivate(){state.active=false;state.drawing=false;state.points=[];closeText({commit:true});clearPreview();if(state.canvas?.parentElement)state.canvas.parentElement.classList.remove('active');if(state.toolbar)state.toolbar.hidden=true;if(state.button)state.button.textContent='Annotate';return false;}
  function ensure(){
    ensureStyle();const host=stage();if(!host)return null;
    if(!state.canvas?.isConnected){
      const layer=document.createElement('div');layer.className='remote-annotation-viewer';const canvas=document.createElement('canvas');layer.append(canvas);host.append(layer);state.canvas=canvas;state.ctx=canvas.getContext('2d');canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
      const toolbar=document.createElement('div');toolbar.className='remote-annotation-toolbar';toolbar.hidden=true;toolbar.innerHTML='<button type="button" data-remote-mode="pen" class="active">Draw</button><button type="button" data-remote-mode="highlight">Highlight</button><button type="button" data-remote-mode="text">Text</button><button type="button" data-remote-mode="erase">Erase</button><span class="remote-annotation-colors"><button type="button" data-remote-color="#ff3b30" class="active" aria-label="Red"></button><button type="button" data-remote-color="#2d8cff" aria-label="Blue"></button><button type="button" data-remote-color="#28c76f" aria-label="Green"></button></span><button type="button" data-remote-done>Done</button>';host.append(toolbar);state.toolbar=toolbar;
      toolbar.querySelectorAll('[data-remote-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.remoteMode));toolbar.querySelectorAll('[data-remote-color]').forEach(b=>{b.style.background=b.dataset.remoteColor;b.onclick=()=>{state.color=b.dataset.remoteColor;toolbar.querySelectorAll('[data-remote-color]').forEach(x=>x.classList.toggle('active',x===b));};});toolbar.querySelector('[data-remote-done]').onclick=deactivate;
    }
    if(!state.button?.isConnected){const button=document.createElement('button');button.type='button';button.className='remote-annotation-button';button.textContent='Annotate';button.hidden=true;button.onclick=()=>state.active?deactivate():void activate();host.append(button);state.button=button;}
    resize();return host;
  }
  async function refresh(){
    const host=ensure(),video=remoteVideo();if(!host)return;const p=await policy();const visible=Boolean(video&&p.enabled);
    if(state.button)state.button.hidden=!visible;
    if(!visible&&state.active)deactivate();
  }
  const observer=new MutationObserver(()=>void refresh());observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});
  window.addEventListener('resize',resize,{passive:true});setInterval(()=>void refresh(),1000);void refresh();
  window.DominionRemoteAnnotation=Object.freeze({version:'1.0.0',activate,deactivate,state:()=>({active:state.active,mode:state.mode,color:state.color,policy:{...state.policy}}),dispose:()=>{observer.disconnect();clearInterval();}});
})();