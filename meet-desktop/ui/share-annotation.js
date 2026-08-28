(()=>{
  if(window.DominionShareAnnotation)return;
  const q=s=>document.querySelector(s);
  const state={active:false,mode:'pen',drawing:false,last:null,overlay:null,canvas:null,ctx:null,resizeObserver:null};
  const share=()=>window.DominionShareController||null;
  function resize(){const stage=q('.stage'),canvas=state.canvas;if(!stage||!canvas)return;const r=stage.getBoundingClientRect(),ratio=Math.max(1,Math.min(2,window.devicePixelRatio||1));const w=Math.max(2,Math.round(r.width*ratio)),h=Math.max(2,Math.round(r.height*ratio));if(canvas.width===w&&canvas.height===h)return;const old=document.createElement('canvas');old.width=canvas.width;old.height=canvas.height;old.getContext('2d')?.drawImage(canvas,0,0);canvas.width=w;canvas.height=h;if(old.width&&old.height)canvas.getContext('2d')?.drawImage(old,0,0,old.width,old.height,0,0,w,h);state.ctx=canvas.getContext('2d');share()?.setAnnotationCanvas?.(canvas);}
  function point(event){const r=state.canvas.getBoundingClientRect();return {x:(event.clientX-r.left)*(state.canvas.width/r.width),y:(event.clientY-r.top)*(state.canvas.height/r.height)};}
  function style(){const ctx=state.ctx;if(!ctx)return;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation=state.mode==='erase'?'destination-out':'source-over';ctx.globalAlpha=state.mode==='highlight'?.38:1;ctx.strokeStyle=state.mode==='highlight'?'#ffe45e':'#ff3b30';ctx.lineWidth=state.mode==='highlight'?18:5;}
  function down(event){if(!state.active||event.button!==0)return;state.drawing=true;state.last=point(event);state.canvas.setPointerCapture?.(event.pointerId);event.preventDefault();}
  function move(event){if(!state.drawing||!state.last)return;const next=point(event);style();state.ctx.beginPath();state.ctx.moveTo(state.last.x,state.last.y);state.ctx.lineTo(next.x,next.y);state.ctx.stroke();state.ctx.globalAlpha=1;state.last=next;event.preventDefault();}
  function up(event){if(!state.drawing)return;state.drawing=false;state.last=null;state.canvas.releasePointerCapture?.(event.pointerId);}
  function setMode(mode){state.mode=mode;for(const b of state.overlay?.querySelectorAll('[data-annotation-mode]')||[])b.classList.toggle('active',b.dataset.annotationMode===mode);}
  function clear(){state.ctx?.clearRect(0,0,state.canvas.width,state.canvas.height);}
  function ensure(){
    const stage=q('.stage');if(!stage)return null;if(state.overlay?.isConnected)return state.overlay;
    const overlay=document.createElement('div');overlay.className='share-annotation-overlay';overlay.hidden=true;overlay.innerHTML='<canvas class="share-annotation-canvas"></canvas><div class="share-annotation-tools"><button type="button" data-annotation-mode="pen">Pen</button><button type="button" data-annotation-mode="highlight">Highlight</button><button type="button" data-annotation-mode="erase">Erase</button><button type="button" data-annotation-clear>Clear</button><button type="button" data-annotation-close>Done</button></div>';stage.append(overlay);state.overlay=overlay;state.canvas=overlay.querySelector('canvas');state.ctx=state.canvas.getContext('2d');state.canvas.addEventListener('pointerdown',down);state.canvas.addEventListener('pointermove',move);state.canvas.addEventListener('pointerup',up);state.canvas.addEventListener('pointercancel',up);overlay.querySelectorAll('[data-annotation-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.annotationMode));overlay.querySelector('[data-annotation-clear]').onclick=clear;overlay.querySelector('[data-annotation-close]').onclick=()=>deactivate();state.resizeObserver=new ResizeObserver(resize);state.resizeObserver.observe(stage);resize();setMode('pen');return overlay;
  }
  function activate(){const controller=share();if(!controller?.snapshot?.().active)return false;const overlay=ensure();if(!overlay)return false;state.active=true;overlay.hidden=false;overlay.classList.add('active');resize();controller.setAnnotationCanvas(state.canvas);return true;}
  function deactivate(){state.active=false;state.drawing=false;if(state.overlay){state.overlay.classList.remove('active');state.overlay.hidden=true;}share()?.setAnnotationCanvas?.(null);return false;}
  function toggle(){return state.active?deactivate():activate();}
  setInterval(()=>{if(state.active&&!share()?.snapshot?.().active)deactivate();},400);
  window.DominionShareAnnotation=Object.freeze({activate,deactivate,toggle,clear,snapshot:()=>({active:state.active,mode:state.mode})});
})();
