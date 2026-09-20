(()=>{
  if(window.DominionShareAnnotation)return;
  const q=s=>document.querySelector(s);
  const state={active:false,mode:'pen',color:'#ff3b30',drawing:false,last:null,overlay:null,canvas:null,ctx:null,resizeObserver:null,history:[],redo:[],laserBase:null,laserTimer:0,textEditor:null,textPoint:null};
  const share=()=>window.DominionShareController||null;
  function resize(){const stage=q('.stage'),canvas=state.canvas;if(!stage||!canvas)return;const r=stage.getBoundingClientRect(),ratio=Math.max(1,Math.min(2,window.devicePixelRatio||1));const w=Math.max(2,Math.round(r.width*ratio)),h=Math.max(2,Math.round(r.height*ratio));if(canvas.width===w&&canvas.height===h)return;const old=document.createElement('canvas');old.width=canvas.width;old.height=canvas.height;old.getContext('2d')?.drawImage(canvas,0,0);canvas.width=w;canvas.height=h;if(old.width&&old.height)canvas.getContext('2d')?.drawImage(old,0,0,old.width,old.height,0,0,w,h);state.ctx=canvas.getContext('2d');share()?.setAnnotationCanvas?.(canvas);}
  function point(event){const r=state.canvas.getBoundingClientRect();return {x:(event.clientX-r.left)*(state.canvas.width/r.width),y:(event.clientY-r.top)*(state.canvas.height/r.height)};}
  function style(){const ctx=state.ctx;if(!ctx)return;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation=state.mode==='erase'?'destination-out':'source-over';ctx.globalAlpha=state.mode==='highlight'?.34:1;ctx.strokeStyle=state.mode==='highlight'?'#ffe45e':state.color;ctx.lineWidth=state.mode==='highlight'?18:state.mode==='erase'?24:5;}
  function captureImage(){if(!state.ctx||!state.canvas)return null;try{return state.ctx.getImageData(0,0,state.canvas.width,state.canvas.height);}catch{return null;}}
  function pushHistory({clearRedo=true}={}){const image=captureImage();if(!image)return;state.history.push(image);if(state.history.length>20)state.history.shift();if(clearRedo)state.redo.length=0;syncHistory();}
  function syncHistory(){const undoButton=state.overlay?.querySelector('[data-annotation-undo]'),redoButton=state.overlay?.querySelector('[data-annotation-redo]');if(undoButton)undoButton.disabled=!state.history.length;if(redoButton)redoButton.disabled=!state.redo.length;}
  function restore(image){if(!image||!state.ctx)return;state.ctx.globalAlpha=1;state.ctx.globalCompositeOperation='source-over';state.ctx.putImageData(image,0,0);}
  function undo(){const image=state.history.pop();if(!image){syncHistory();return;}const current=captureImage();if(current){state.redo.push(current);if(state.redo.length>20)state.redo.shift();}restore(image);syncHistory();}
  function redo(){const image=state.redo.pop();if(!image){syncHistory();return;}const current=captureImage();if(current){state.history.push(current);if(state.history.length>20)state.history.shift();}restore(image);syncHistory();}
  function drawLaser(point){if(!state.ctx||!state.laserBase)return;restore(state.laserBase);state.ctx.save();state.ctx.globalCompositeOperation='source-over';state.ctx.globalAlpha=.98;state.ctx.fillStyle='#ff3b30';state.ctx.shadowColor='rgba(255,59,48,.78)';state.ctx.shadowBlur=18;state.ctx.beginPath();state.ctx.arc(point.x,point.y,9,0,Math.PI*2);state.ctx.fill();state.ctx.restore();}
  function clearLaser(delay=0){clearTimeout(state.laserTimer);const run=()=>{if(state.laserBase){restore(state.laserBase);state.laserBase=null;}};if(delay)state.laserTimer=setTimeout(run,delay);else run();}
  function closeTextEditor({commit=false}={}){
    const editor=state.textEditor,at=state.textPoint;state.textEditor=null;state.textPoint=null;
    if(!editor)return;
    const value=String(editor.value||'').trimEnd();editor.remove();
    if(!commit||!value||!at||!state.ctx)return;
    pushHistory();state.ctx.save();state.ctx.globalAlpha=1;state.ctx.globalCompositeOperation='source-over';state.ctx.fillStyle=state.color;state.ctx.font='600 26px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';state.ctx.textBaseline='top';
    value.split(/\n/).slice(0,8).forEach((line,index)=>state.ctx.fillText(line,at.x,at.y+(index*31),Math.max(120,state.canvas.width-at.x-12)));
    state.ctx.restore();
  }
  function beginText(event){
    closeTextEditor({commit:true});
    const at=point(event),rect=state.canvas.getBoundingClientRect(),editor=document.createElement('textarea');
    editor.className='share-annotation-text-editor';editor.rows=2;editor.maxLength=500;editor.placeholder='Type text';
    editor.style.left=String(event.clientX-rect.left)+'px';editor.style.top=String(event.clientY-rect.top)+'px';
    state.overlay.append(editor);state.textEditor=editor;state.textPoint=at;
    editor.addEventListener('keydown',keyEvent=>{if(keyEvent.key==='Escape'){keyEvent.preventDefault();closeTextEditor({commit:false});return;}if(keyEvent.key==='Enter'&&!keyEvent.shiftKey){keyEvent.preventDefault();closeTextEditor({commit:true});}});
    editor.addEventListener('blur',()=>{if(state.textEditor===editor)closeTextEditor({commit:true});},{once:true});
    queueMicrotask(()=>editor.focus());
  }
  function down(event){if(!state.active||event.button!==0)return;if(state.mode==='text'){beginText(event);event.preventDefault();return;}state.drawing=true;state.last=point(event);state.canvas.setPointerCapture?.(event.pointerId);if(state.mode==='laser'){clearLaser();try{state.laserBase=state.ctx.getImageData(0,0,state.canvas.width,state.canvas.height);}catch{state.laserBase=null;}if(state.laserBase)drawLaser(state.last);}else pushHistory();event.preventDefault();}
  function move(event){if(!state.drawing||!state.last)return;const next=point(event);if(state.mode==='laser'){if(state.laserBase)drawLaser(next);state.last=next;event.preventDefault();return;}style();state.ctx.beginPath();state.ctx.moveTo(state.last.x,state.last.y);state.ctx.lineTo(next.x,next.y);state.ctx.stroke();state.ctx.globalAlpha=1;state.last=next;event.preventDefault();}
  function up(event){if(!state.drawing)return;state.drawing=false;state.last=null;state.canvas.releasePointerCapture?.(event.pointerId);if(state.mode==='laser')clearLaser(650);}
  function setMode(mode){if(state.mode==='laser'&&mode!=='laser')clearLaser();if(state.mode==='text'&&mode!=='text')closeTextEditor({commit:true});state.mode=mode;for(const b of state.overlay?.querySelectorAll('[data-annotation-mode]')||[])b.classList.toggle('active',b.dataset.annotationMode===mode);}
  function clear(){if(!state.ctx||!state.canvas)return;closeTextEditor({commit:true});pushHistory();clearLaser();state.ctx.clearRect(0,0,state.canvas.width,state.canvas.height);}
  function ensure(){
    const stage=q('.stage');if(!stage)return null;if(state.overlay?.isConnected)return state.overlay;
    const overlay=document.createElement('div');overlay.className='share-annotation-overlay';overlay.hidden=true;overlay.innerHTML='<canvas class="share-annotation-canvas"></canvas><div class="share-annotation-tools"><button type="button" data-annotation-mode="pen">Pen</button><button type="button" data-annotation-mode="highlight">Highlight</button><button type="button" data-annotation-mode="laser">Laser</button><button type="button" data-annotation-mode="erase">Erase</button><span class="annotation-colors" aria-label="Annotation color"><button type="button" data-annotation-color="#ff3b30" class="active" aria-label="Red"></button><button type="button" data-annotation-color="#2d8cff" aria-label="Blue"></button><button type="button" data-annotation-color="#28c76f" aria-label="Green"></button><button type="button" data-annotation-color="#ffffff" aria-label="White"></button></span><button type="button" data-annotation-undo disabled>Undo</button><button type="button" data-annotation-clear>Clear</button><button type="button" data-annotation-close>Done</button></div>';stage.append(overlay);state.overlay=overlay;state.canvas=overlay.querySelector('canvas');state.ctx=state.canvas.getContext('2d');state.canvas.addEventListener('pointerdown',down);state.canvas.addEventListener('pointermove',move);state.canvas.addEventListener('pointerup',up);state.canvas.addEventListener('pointercancel',up);overlay.querySelectorAll('[data-annotation-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.annotationMode));overlay.querySelectorAll('[data-annotation-color]').forEach(b=>b.onclick=()=>{state.color=b.dataset.annotationColor||'#ff3b30';overlay.querySelectorAll('[data-annotation-color]').forEach(x=>x.classList.toggle('active',x===b));});overlay.querySelector('[data-annotation-undo]').onclick=undo;overlay.querySelector('[data-annotation-clear]').onclick=clear;overlay.querySelector('[data-annotation-close]').onclick=()=>deactivate();state.resizeObserver=new ResizeObserver(resize);state.resizeObserver.observe(stage);resize();setMode('pen');syncUndo();return overlay;
  }
  function activate(){const controller=share();if(!controller?.snapshot?.().active)return false;const overlay=ensure();if(!overlay)return false;state.active=true;overlay.hidden=false;overlay.classList.add('active');resize();controller.setAnnotationCanvas(state.canvas);return true;}
  function deactivate(){
    const controller=share();
    const controllerAnnotating=Boolean(controller?.snapshot?.().annotating);
    const changed=state.active||state.drawing||controllerAnnotating;
    state.active=false;state.drawing=false;clearLaser();
    if(state.overlay){state.overlay.classList.remove('active');state.overlay.hidden=true;}
    // Do not feed a no-op null canvas back into ShareController. Before capture
    // becomes active, layout synchronization legitimately asks annotation to be
    // inactive; that must remain an idempotent state, not an emit recursion.
    if(controllerAnnotating)controller?.setAnnotationCanvas?.(null);
    return changed?false:false;
  }
  function toggle(){return state.active?deactivate():activate();}
  setInterval(()=>{if(state.active&&!share()?.snapshot?.().active)deactivate();},400);
  window.DominionShareAnnotation=Object.freeze({version:'1.1.1',activate,deactivate,toggle,clear,undo,setMode,snapshot:()=>({active:state.active,mode:state.mode,color:state.color,undoDepth:state.history.length})});
})();
