(()=>{
  if(window.DominionShareAnnotation)return;
  const q=s=>document.querySelector(s);
  const state={
    active:false,mode:'pen',color:'#ff3b30',drawing:false,last:null,start:null,
    overlay:null,canvas:null,ctx:null,localCanvas:null,localCtx:null,remoteCanvas:null,remoteCtx:null,
    resizeObserver:null,history:[],redo:[],laserBase:null,laserTimer:0,textEditor:null,textPoint:null,
    shapeBase:null,lineWidth:5,fontSize:26,hasRemoteAnnotations:false,nameTimer:0,
    selection:{rect:null,box:null,marquee:false,transform:null}
  };
  const share=()=>window.DominionShareController||null;
  const shapeModes=new Set(['line','arrow','rect','ellipse']);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

  function createPlane(width=2,height=2){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}
  function copyPlane(source,width,height){
    const next=createPlane(width,height),ctx=next.getContext('2d');
    if(source?.width&&source?.height)ctx.drawImage(source,0,0,source.width,source.height,0,0,width,height);
    return next;
  }
  function renderComposite(){
    if(!state.ctx||!state.canvas)return;
    state.ctx.setTransform(1,0,0,1,0,0);state.ctx.clearRect(0,0,state.canvas.width,state.canvas.height);
    if(state.localCanvas)state.ctx.drawImage(state.localCanvas,0,0);
    if(state.remoteCanvas)state.ctx.drawImage(state.remoteCanvas,0,0);
  }
  function resize(){
    const stage=q('.stage'),canvas=state.canvas;if(!stage||!canvas)return;
    const r=stage.getBoundingClientRect(),ratio=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    const w=Math.max(2,Math.round(r.width*ratio)),h=Math.max(2,Math.round(r.height*ratio));
    if(canvas.width===w&&canvas.height===h){syncSelectionBox();return;}
    const local=copyPlane(state.localCanvas,w,h),remote=copyPlane(state.remoteCanvas,w,h);
    canvas.width=w;canvas.height=h;state.ctx=canvas.getContext('2d');
    state.localCanvas=local;state.localCtx=local.getContext('2d');
    state.remoteCanvas=remote;state.remoteCtx=remote.getContext('2d');
    renderComposite();syncSelectionBox();share()?.setAnnotationCanvas?.(canvas);
  }
  function point(event){
    const r=state.canvas.getBoundingClientRect();
    return {x:(event.clientX-r.left)*(state.canvas.width/r.width),y:(event.clientY-r.top)*(state.canvas.height/r.height)};
  }
  function style(ctx=state.localCtx,mode=state.mode){
    if(!ctx)return;
    ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation=mode==='erase'?'destination-out':'source-over';
    ctx.globalAlpha=mode==='highlight'?.34:1;ctx.strokeStyle=mode==='highlight'?'#ffe45e':state.color;ctx.fillStyle=state.color;
    ctx.lineWidth=mode==='highlight'?18:mode==='erase'?24:state.lineWidth;
  }
  function captureLocal(){if(!state.localCtx||!state.localCanvas)return null;try{return state.localCtx.getImageData(0,0,state.localCanvas.width,state.localCanvas.height);}catch{return null;}}
  function restoreLocal(image,{render=true}={}){if(!image||!state.localCtx)return;state.localCtx.setTransform(1,0,0,1,0,0);state.localCtx.clearRect(0,0,state.localCanvas.width,state.localCanvas.height);state.localCtx.putImageData(image,0,0);if(render)renderComposite();}
  function pushHistory({clearRedo=true}={}){const image=captureLocal();if(!image)return;state.history.push(image);if(state.history.length>20)state.history.shift();if(clearRedo)state.redo.length=0;syncHistory();}
  function syncHistory(){const undoButton=state.overlay?.querySelector('[data-annotation-undo]'),redoButton=state.overlay?.querySelector('[data-annotation-redo]');if(undoButton)undoButton.disabled=!state.history.length;if(redoButton)redoButton.disabled=!state.redo.length;}
  function undo(){const image=state.history.pop();if(!image){syncHistory();return;}const current=captureLocal();if(current){state.redo.push(current);if(state.redo.length>20)state.redo.shift();}restoreLocal(image);clearSelection();syncHistory();}
  function redo(){const image=state.redo.pop();if(!image){syncHistory();return;}const current=captureLocal();if(current){state.history.push(current);if(state.history.length>20)state.history.shift();}restoreLocal(image);clearSelection();syncHistory();}

  function drawShape(kind,start,end,ctx=state.localCtx){
    if(!ctx||!start||!end)return;style(ctx,kind);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.strokeStyle=state.color;ctx.fillStyle=state.color;ctx.lineWidth=state.lineWidth;ctx.beginPath();
    if(kind==='line'||kind==='arrow'){
      ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
      if(kind==='arrow'){const angle=Math.atan2(end.y-start.y,end.x-start.x),head=Math.max(12,state.lineWidth*4);ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-head*Math.cos(angle-Math.PI/6),end.y-head*Math.sin(angle-Math.PI/6));ctx.lineTo(end.x-head*Math.cos(angle+Math.PI/6),end.y-head*Math.sin(angle+Math.PI/6));ctx.closePath();ctx.fill();}
    }else if(kind==='rect'){
      ctx.strokeRect(Math.min(start.x,end.x),Math.min(start.y,end.y),Math.abs(end.x-start.x),Math.abs(end.y-start.y));
    }else if(kind==='ellipse'){
      const cx=(start.x+end.x)/2,cy=(start.y+end.y)/2,rx=Math.max(1,Math.abs(end.x-start.x)/2),ry=Math.max(1,Math.abs(end.y-start.y)/2);
      ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();
    }
  }
  function drawStamp(kind,at){
    if(!state.localCtx||!at)return;pushHistory();const ctx=state.localCtx;ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle=state.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 42px -apple-system,BlinkMacSystemFont,"Segoe UI Symbol",sans-serif';ctx.fillText(kind==='star'?'★':'✓',at.x,at.y);ctx.restore();renderComposite();
  }
  function drawLaser(at){
    if(!state.localCtx||!state.laserBase)return;restoreLocal(state.laserBase,{render:false});const ctx=state.localCtx;ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.98;ctx.fillStyle='#ff3b30';ctx.shadowColor='rgba(255,59,48,.78)';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(at.x,at.y,9,0,Math.PI*2);ctx.fill();ctx.restore();renderComposite();
  }
  function clearLaser(delay=0){clearTimeout(state.laserTimer);const run=()=>{if(state.laserBase){restoreLocal(state.laserBase);state.laserBase=null;}};if(delay)state.laserTimer=setTimeout(run,delay);else run();}

  function closeTextEditor({commit=false}={}){
    const editor=state.textEditor,at=state.textPoint;state.textEditor=null;state.textPoint=null;if(!editor)return;
    const value=String(editor.value||'').trimEnd();editor.remove();if(!commit||!value||!at||!state.localCtx)return;
    pushHistory();const ctx=state.localCtx;ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle=state.color;ctx.font='600 '+state.fontSize+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.textBaseline='top';
    const lineHeight=Math.round(state.fontSize*1.22);value.split(/\n/).slice(0,8).forEach((line,index)=>ctx.fillText(line,at.x,at.y+(index*lineHeight),Math.max(120,state.localCanvas.width-at.x-12)));ctx.restore();renderComposite();
  }
  function beginText(event){
    closeTextEditor({commit:true});const at=point(event),rect=state.canvas.getBoundingClientRect(),editor=document.createElement('textarea');
    editor.className='share-annotation-text-editor';editor.rows=2;editor.maxLength=500;editor.placeholder='Type text';editor.style.left=String(event.clientX-rect.left)+'px';editor.style.top=String(event.clientY-rect.top)+'px';
    state.overlay.append(editor);state.textEditor=editor;state.textPoint=at;
    editor.addEventListener('keydown',keyEvent=>{if(keyEvent.key==='Escape'){keyEvent.preventDefault();closeTextEditor({commit:false});return;}if(keyEvent.key==='Enter'&&!keyEvent.shiftKey){keyEvent.preventDefault();closeTextEditor({commit:true});}});
    editor.addEventListener('blur',()=>{if(state.textEditor===editor)closeTextEditor({commit:true});},{once:true});queueMicrotask(()=>editor.focus());
  }

  function normalizeRect(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);return {x,y,w,h};}
  function clampRect(rect){
    const min=8,x=clamp(rect.x,0,state.localCanvas.width-min),y=clamp(rect.y,0,state.localCanvas.height-min);
    return {x,y,w:clamp(rect.w,min,state.localCanvas.width-x),h:clamp(rect.h,min,state.localCanvas.height-y)};
  }
  function localHasContent(rect){
    if(!state.localCtx||!rect||rect.w<2||rect.h<2)return false;
    const x=Math.floor(clamp(rect.x,0,state.localCanvas.width-1)),y=Math.floor(clamp(rect.y,0,state.localCanvas.height-1));
    const w=Math.max(1,Math.floor(Math.min(rect.w,state.localCanvas.width-x))),h=Math.max(1,Math.floor(Math.min(rect.h,state.localCanvas.height-y)));
    try{const data=state.localCtx.getImageData(x,y,w,h).data;for(let i=3;i<data.length;i+=4)if(data[i]>8)return true;}catch{}return false;
  }
  function selectionBox(){
    if(state.selection.box?.isConnected)return state.selection.box;
    const box=document.createElement('div');box.className='share-annotation-selection';box.hidden=true;box.innerHTML='<i data-select-handle="nw"></i><i data-select-handle="ne"></i><i data-select-handle="sw"></i><i data-select-handle="se"></i>';state.overlay?.append(box);state.selection.box=box;
    box.addEventListener('pointerdown',event=>{if(state.mode!=='select'||!state.selection.rect)return;event.stopPropagation();event.preventDefault();beginSelectionTransform(event,event.target.dataset.selectHandle||'move');});
    return box;
  }
  function syncSelectionBox(){
    const box=selectionBox(),rect=state.selection.rect;if(!box||!state.canvas||!rect){if(box)box.hidden=true;return;}
    box.hidden=false;box.style.left=(rect.x/state.canvas.width*100)+'%';box.style.top=(rect.y/state.canvas.height*100)+'%';box.style.width=(rect.w/state.canvas.width*100)+'%';box.style.height=(rect.h/state.canvas.height*100)+'%';
  }
  function clearSelection(){state.selection.rect=null;state.selection.marquee=false;state.selection.transform=null;const box=state.selection.box;if(box)box.hidden=true;}
  function hasLocalAnnotations(){return Boolean(state.localCanvas&&localHasContent({x:0,y:0,w:state.localCanvas.width,h:state.localCanvas.height}));}
  function selectionRectFromHandle(start,handle,at){
    let x1=start.x,y1=start.y,x2=start.x+start.w,y2=start.y+start.h;
    if(handle.includes('w'))x1=at.x;if(handle.includes('e'))x2=at.x;if(handle.includes('n'))y1=at.y;if(handle.includes('s'))y2=at.y;
    const a={x:clamp(Math.min(x1,x2),0,state.localCanvas.width-8),y:clamp(Math.min(y1,y2),0,state.localCanvas.height-8)};
    const b={x:clamp(Math.max(x1,x2),a.x+8,state.localCanvas.width),y:clamp(Math.max(y1,y2),a.y+8,state.localCanvas.height)};
    return {x:a.x,y:a.y,w:b.x-a.x,h:b.y-a.y};
  }
  function drawSelectionBitmap(image,rect){
    if(!image||!state.localCtx||!rect)return;
    const temp=createPlane(image.width,image.height);temp.getContext('2d').putImageData(image,0,0);
    state.localCtx.drawImage(temp,0,0,image.width,image.height,rect.x,rect.y,rect.w,rect.h);
  }
  function beginSelectionTransform(event,handle){
    const source=state.selection.rect;if(!source||!localHasContent(source))return;
    const at=point(event),base=captureLocal();if(!base)return;pushHistory();
    let image=null;try{image=state.localCtx.getImageData(Math.floor(source.x),Math.floor(source.y),Math.max(1,Math.floor(source.w)),Math.max(1,Math.floor(source.h)));}catch{return;}
    state.selection.transform={pointerId:event.pointerId,handle,startPoint:at,startRect:{...source},source:{...source},base,image};
    state.selection.box?.setPointerCapture?.(event.pointerId);
  }
  function updateSelectionTransform(event){
    const t=state.selection.transform;if(!t||event.pointerId!==t.pointerId)return;const at=point(event);let rect={...t.startRect};
    if(t.handle==='move'){rect.x=clamp(t.startRect.x+(at.x-t.startPoint.x),0,state.localCanvas.width-t.startRect.w);rect.y=clamp(t.startRect.y+(at.y-t.startPoint.y),0,state.localCanvas.height-t.startRect.h);}
    else rect=selectionRectFromHandle(t.startRect,t.handle,at);
    restoreLocal(t.base,{render:false});state.localCtx.clearRect(t.source.x,t.source.y,t.source.w,t.source.h);drawSelectionBitmap(t.image,rect);renderComposite();state.selection.rect=rect;syncSelectionBox();event.preventDefault();
  }
  function endSelectionTransform(event){
    const t=state.selection.transform;if(!t||event.pointerId!==t.pointerId)return;state.selection.box?.releasePointerCapture?.(event.pointerId);state.selection.transform=null;syncSelectionBox();
  }
  function beginSelectionMarquee(event,at){
    clearSelection();state.selection.marquee=true;state.start=at;state.last=at;state.canvas.setPointerCapture?.(event.pointerId);state.selection.rect={x:at.x,y:at.y,w:1,h:1};syncSelectionBox();event.preventDefault();
  }
  function updateSelectionMarquee(event){
    if(!state.selection.marquee||!state.start)return;state.selection.rect=normalizeRect(state.start,point(event));syncSelectionBox();event.preventDefault();
  }
  function endSelectionMarquee(event){
    if(!state.selection.marquee)return;state.selection.marquee=false;state.canvas.releasePointerCapture?.(event.pointerId);
    const rect=clampRect(state.selection.rect||{x:0,y:0,w:0,h:0});state.selection.rect=localHasContent(rect)?rect:null;state.start=null;state.last=null;syncSelectionBox();
  }
  function deleteSelection(){const rect=state.selection.rect;if(!rect||!localHasContent(rect))return false;pushHistory();state.localCtx.clearRect(rect.x,rect.y,rect.w,rect.h);renderComposite();clearSelection();return true;}

  function down(event){
    if(!state.active||event.button!==0)return;const at=point(event);
    if(state.mode==='select'){beginSelectionMarquee(event,at);return;}
    clearSelection();
    if(state.mode==='text'){beginText(event);event.preventDefault();return;}
    if(state.mode==='check'||state.mode==='star'){drawStamp(state.mode,at);event.preventDefault();return;}
    state.drawing=true;state.start=at;state.last=at;state.canvas.setPointerCapture?.(event.pointerId);
    if(state.mode==='laser'){clearLaser();state.laserBase=captureLocal();if(state.laserBase)drawLaser(state.last);}
    else if(shapeModes.has(state.mode)){state.shapeBase=captureLocal();pushHistory();}
    else pushHistory();event.preventDefault();
  }
  function move(event){
    if(state.mode==='select'&&state.selection.marquee){updateSelectionMarquee(event);return;}
    if(!state.drawing||!state.last)return;const next=point(event);
    if(state.mode==='laser'){if(state.laserBase)drawLaser(next);state.last=next;event.preventDefault();return;}
    if(shapeModes.has(state.mode)){if(state.shapeBase)restoreLocal(state.shapeBase,{render:false});drawShape(state.mode,state.start,next);renderComposite();state.last=next;event.preventDefault();return;}
    style();state.localCtx.beginPath();state.localCtx.moveTo(state.last.x,state.last.y);state.localCtx.lineTo(next.x,next.y);state.localCtx.stroke();state.localCtx.globalAlpha=1;renderComposite();state.last=next;event.preventDefault();
  }
  function up(event){
    if(state.mode==='select'&&state.selection.marquee){endSelectionMarquee(event);return;}
    if(!state.drawing)return;
    if(shapeModes.has(state.mode)&&state.start){const end=point(event);if(state.shapeBase)restoreLocal(state.shapeBase,{render:false});drawShape(state.mode,state.start,end);renderComposite();}
    state.drawing=false;state.last=null;state.start=null;state.shapeBase=null;state.canvas.releasePointerCapture?.(event.pointerId);if(state.mode==='laser')clearLaser(650);
  }
  function setMode(mode){
    if(state.mode==='laser'&&mode!=='laser')clearLaser();if(state.mode==='text'&&mode!=='text')closeTextEditor({commit:true});
    state.mode=mode;if(mode!=='select')clearSelection();for(const b of state.overlay?.querySelectorAll('[data-annotation-mode]')||[])b.classList.toggle('active',b.dataset.annotationMode===mode);
  }
  function clear(){
    if(!state.localCtx||!state.remoteCtx)return;closeTextEditor({commit:true});pushHistory();clearLaser();
    state.localCtx.clearRect(0,0,state.localCanvas.width,state.localCanvas.height);state.remoteCtx.clearRect(0,0,state.remoteCanvas.width,state.remoteCanvas.height);
    state.hasRemoteAnnotations=false;renderComposite();clearSelection();if(state.overlay){state.overlay.classList.remove('remote-visible','persist-visible');if(!state.active)state.overlay.hidden=true;}if(!state.active&&share()?.snapshot?.().annotating)share()?.setAnnotationCanvas?.(null);
  }

  async function collaborativePolicy(){
    try{const ctx=await window.dominionDesktop?.meeting?.context?.();if(!ctx?.roomId)return {enabled:false,showNames:true};const snapshot=await window.dominionDesktop?.meeting?.snapshot?.(ctx.roomId);return {enabled:snapshot?.annotationEnabled!==false,showNames:snapshot?.annotationNamesVisible!==false};}
    catch{return {enabled:false,showNames:true};}
  }
  function ensureRemoteCanvas(){
    const controller=share();if(!controller?.snapshot?.().active)return null;const overlay=ensure();if(!overlay)return null;
    state.hasRemoteAnnotations=true;overlay.hidden=false;overlay.classList.add('remote-visible');controller.setAnnotationCanvas(state.canvas);return overlay;
  }
  function showAnnotatorName(name,at){
    if(!state.overlay||!at)return;clearTimeout(state.nameTimer);let badge=state.overlay.querySelector('.share-annotator-name');
    if(!badge){badge=document.createElement('div');badge.className='share-annotator-name';state.overlay.append(badge);}
    badge.textContent=String(name||'Participant').slice(0,80);badge.hidden=false;badge.style.left=Math.max(0,Math.min(100,Number(at.x)||0))*100+'%';badge.style.top=Math.max(0,Math.min(100,Number(at.y)||0))*100+'%';state.nameTimer=setTimeout(()=>{if(badge)badge.hidden=true;},1800);
  }
  async function applyRemoteStroke(payload={},fromName='Participant'){
    const policy=await collaborativePolicy();if(!policy.enabled)return false;const points=Array.isArray(payload.points)?payload.points.slice(0,240):[];if(points.length<1)return false;
    if(!ensureRemoteCanvas()||!state.remoteCtx||!state.remoteCanvas)return false;
    const mode=['pen','highlight','erase'].includes(String(payload.mode||''))?String(payload.mode):'pen',color=/^#[0-9a-f]{6}$/i.test(String(payload.color||''))?String(payload.color):'#ff3b30',width=Math.max(2,Math.min(24,Number(payload.width)||5));
    const ctx=state.remoteCtx;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation=mode==='erase'?'destination-out':'source-over';ctx.globalAlpha=mode==='highlight'?.34:1;ctx.strokeStyle=mode==='highlight'?'#ffe45e':color;ctx.lineWidth=mode==='highlight'?Math.max(14,width*3):mode==='erase'?Math.max(18,width*3):width;
    const mapped=points.map(p=>({x:Math.max(0,Math.min(1,Number(p?.x)||0))*state.remoteCanvas.width,y:Math.max(0,Math.min(1,Number(p?.y)||0))*state.remoteCanvas.height}));
    if(mapped.length===1){ctx.beginPath();ctx.arc(mapped[0].x,mapped[0].y,ctx.lineWidth/2,0,Math.PI*2);ctx.fillStyle=mode==='erase'?'rgba(0,0,0,1)':ctx.strokeStyle;ctx.fill();}else{ctx.beginPath();ctx.moveTo(mapped[0].x,mapped[0].y);for(const p of mapped.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();}
    ctx.restore();renderComposite();if(policy.showNames)showAnnotatorName(fromName,points[points.length-1]);return true;
  }
  async function applyRemoteText(payload={},fromName='Participant'){
    const policy=await collaborativePolicy();if(!policy.enabled)return false;const text=String(payload.text||'').trim().slice(0,500);if(!text||!ensureRemoteCanvas()||!state.remoteCtx||!state.remoteCanvas)return false;
    const x=Math.max(0,Math.min(1,Number(payload.x)||0)),y=Math.max(0,Math.min(1,Number(payload.y)||0)),color=/^#[0-9a-f]{6}$/i.test(String(payload.color||''))?String(payload.color):'#ff3b30',size=Math.max(16,Math.min(42,Number(payload.fontSize)||26));
    const ctx=state.remoteCtx;ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle=color;ctx.font='600 '+size+'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.textBaseline='top';
    const px=x*state.remoteCanvas.width,py=y*state.remoteCanvas.height,lineHeight=Math.round(size*1.22);text.split(/\n/).slice(0,8).forEach((line,index)=>ctx.fillText(line,px,py+(index*lineHeight),Math.max(120,state.remoteCanvas.width-px-12)));ctx.restore();
    renderComposite();if(policy.showNames)showAnnotatorName(fromName,{x,y});return true;
  }

  async function save(format='png'){
    const controller=share();if(!controller?.snapshot?.().active)return false;const normalized=String(format||'png').toLowerCase()==='pdf'?'pdf':'png';
    const button=state.overlay?.querySelector(`[data-annotation-save="${normalized}"]`),prior=button?.textContent||'';if(button){button.disabled=true;button.textContent='Saving…';}
    try{
      const dataUrl=await controller.exportImage?.();if(!dataUrl)throw new Error('Unable to prepare the annotated screen.');
      const room=String(q('#roomCodeLabel')?.textContent||'').replace(/\D/g,'').trim(),result=await window.dominionDesktop?.annotation?.save?.({format:normalized,dataUrl,title:`DominionStar annotation${room?' '+room:''}`});
      if(result?.canceled)return false;if(!result?.ok)throw new Error('Annotation could not be saved.');if(button){button.textContent='Saved';setTimeout(()=>{if(button.isConnected)button.textContent=prior;},1400);}return true;
    }catch(error){if(button){button.textContent='Save failed';setTimeout(()=>{if(button.isConnected)button.textContent=prior;},1800);}console.error('[DominionStar Meet] Annotation save failed.',error);return false;}
    finally{if(button)button.disabled=false;}
  }

  function ensure(){
    const stage=q('.stage');if(!stage)return null;if(state.overlay?.isConnected)return state.overlay;
    const overlay=document.createElement('div');overlay.className='share-annotation-overlay';overlay.hidden=true;
    overlay.innerHTML='<canvas class="share-annotation-canvas"></canvas><div class="share-annotation-tools" role="toolbar" aria-label="Annotation tools"><button type="button" data-annotation-mode="select">Select</button><button type="button" data-annotation-mode="pen">Draw</button><button type="button" data-annotation-mode="line">Line</button><button type="button" data-annotation-mode="arrow">Arrow</button><button type="button" data-annotation-mode="rect">Rectangle</button><button type="button" data-annotation-mode="ellipse">Ellipse</button><button type="button" data-annotation-mode="highlight">Highlight</button><button type="button" data-annotation-mode="text">Text</button><button type="button" data-annotation-mode="check">✓ Stamp</button><button type="button" data-annotation-mode="star">★ Stamp</button><button type="button" data-annotation-mode="laser" title="Spotlight / laser pointer">Spotlight</button><button type="button" data-annotation-mode="erase">Erase</button><span class="annotation-format" aria-label="Annotation format"><label>Width<select data-annotation-width><option value="3">Thin</option><option value="5" selected>Medium</option><option value="8">Thick</option></select></label><label>Text<select data-annotation-font-size><option value="20">20</option><option value="26" selected>26</option><option value="34">34</option></select></label></span><span class="annotation-colors" aria-label="Annotation color"><button type="button" data-annotation-color="#ff3b30" class="active" aria-label="Red"></button><button type="button" data-annotation-color="#2d8cff" aria-label="Blue"></button><button type="button" data-annotation-color="#28c76f" aria-label="Green"></button><button type="button" data-annotation-color="#ffffff" aria-label="White"></button></span><button type="button" data-annotation-undo disabled>Undo</button><button type="button" data-annotation-redo disabled>Redo</button><button type="button" data-annotation-clear>Clear</button><span class="annotation-save-actions" aria-label="Save annotation"><button type="button" data-annotation-save="png">Save PNG</button><button type="button" data-annotation-save="pdf">Save PDF</button></span><button type="button" data-annotation-close>Done</button></div>';
    stage.append(overlay);state.overlay=overlay;state.canvas=overlay.querySelector('canvas');state.ctx=state.canvas.getContext('2d');state.localCanvas=createPlane();state.localCtx=state.localCanvas.getContext('2d');state.remoteCanvas=createPlane();state.remoteCtx=state.remoteCanvas.getContext('2d');
    state.canvas.addEventListener('pointerdown',down);state.canvas.addEventListener('pointermove',move);state.canvas.addEventListener('pointerup',up);state.canvas.addEventListener('pointercancel',up);
    window.addEventListener('pointermove',updateSelectionTransform,true);window.addEventListener('pointerup',endSelectionTransform,true);window.addEventListener('pointercancel',endSelectionTransform,true);
    overlay.querySelectorAll('[data-annotation-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.annotationMode));
    overlay.querySelectorAll('[data-annotation-color]').forEach(b=>b.onclick=()=>{state.color=b.dataset.annotationColor||'#ff3b30';overlay.querySelectorAll('[data-annotation-color]').forEach(x=>x.classList.toggle('active',x===b));});
    overlay.querySelector('[data-annotation-width]').onchange=event=>{state.lineWidth=Math.max(1,Number(event.currentTarget.value)||5);};overlay.querySelector('[data-annotation-font-size]').onchange=event=>{state.fontSize=Math.max(12,Number(event.currentTarget.value)||26);};
    overlay.querySelector('[data-annotation-undo]').onclick=undo;overlay.querySelector('[data-annotation-redo]').onclick=redo;overlay.querySelector('[data-annotation-clear]').onclick=clear;overlay.querySelectorAll('[data-annotation-save]').forEach(button=>button.onclick=()=>void save(button.dataset.annotationSave));overlay.querySelector('[data-annotation-close]').onclick=()=>deactivate();
    state.resizeObserver=new ResizeObserver(resize);state.resizeObserver.observe(stage);resize();selectionBox();setMode('pen');syncHistory();return overlay;
  }
  function activate(){const controller=share();if(!controller?.snapshot?.().active)return false;const overlay=ensure();if(!overlay)return false;state.active=true;overlay.hidden=false;overlay.classList.add('active');resize();controller.setAnnotationCanvas(state.canvas);return true;}
  function deactivate(){
    const controller=share(),controllerAnnotating=Boolean(controller?.snapshot?.().annotating),changed=state.active||state.drawing||controllerAnnotating;
    state.active=false;state.drawing=false;closeTextEditor({commit:true});clearLaser();clearSelection();
    const localAnnotations=hasLocalAnnotations(),persistent=localAnnotations||state.hasRemoteAnnotations;
    if(state.overlay){state.overlay.classList.remove('active');state.overlay.hidden=!persistent;state.overlay.classList.toggle('remote-visible',state.hasRemoteAnnotations);state.overlay.classList.toggle('persist-visible',persistent);}
    if(controllerAnnotating&&!persistent)controller?.setAnnotationCanvas?.(null);
    return changed?false:false;
  }
  function toggle(){return state.active?deactivate():activate();}
  window.addEventListener('dominion:meeting-signal',event=>{const detail=event.detail||{},type=String(detail.type||'');if(type==='annotation:stroke')void applyRemoteStroke(detail.payload||{},detail.fromDisplayName||'Participant');if(type==='annotation:text')void applyRemoteText(detail.payload||{},detail.fromDisplayName||'Participant');});
  document.addEventListener('keydown',event=>{
    if(!state.active)return;const modifier=event.metaKey||event.ctrlKey,key=String(event.key||'').toLowerCase();
    if(modifier&&key==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();return;}
    if(state.mode==='select'&&(event.key==='Backspace'||event.key==='Delete')){event.preventDefault();deleteSelection();}
    if(state.mode==='select'&&event.key==='Escape')clearSelection();
  });
  setInterval(()=>{if(state.active&&!share()?.snapshot?.().active)deactivate();},400);
  window.DominionShareAnnotation=Object.freeze({version:'1.5.0',activate,deactivate,toggle,clear,undo,redo,save,setMode,applyRemoteStroke,applyRemoteText,snapshot:()=>({active:state.active,mode:state.mode,color:state.color,undoDepth:state.history.length,redoDepth:state.redo.length,hasRemoteAnnotations:state.hasRemoteAnnotations,selection:state.selection.rect?{...state.selection.rect}:null})});
})();