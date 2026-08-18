(() => {
  'use strict';
  if (window.DominionBackgroundEffects2030) return;

  const engine = window.DominionStarMeetingEngine;
  const backgroundSelect = document.getElementById('backgroundSelect');
  const brightnessRange = document.getElementById('brightnessRange');
  const touchRange = document.getElementById('touchAppearanceRange');
  const mirrorToggle = document.getElementById('mirrorToggle');
  if (!engine || !backgroundSelect) return;

  const TASKS_VERSION = '1.0.1';
  const TASKS_MODULE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/+esm`;
  const TASKS_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
  const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite';
  const TARGET_SEGMENT_FPS = 15;
  const OUTPUT_FPS = 30;

  const originalStartMedia = engine.startMedia.bind(engine);
  const originalToggleVideo = engine.toggleVideo.bind(engine);
  let segmenterPromise = null;
  let active = null;
  let generation = 0;
  let wrapping = false;

  const localVideos = () => [
    document.getElementById('prejoinVideo'),
    document.getElementById('selfVideo'),
    document.getElementById('stageVideo')
  ].filter(Boolean);

  const selectedMode = () => ['blur','portrait'].includes(backgroundSelect.value) ? backgroundSelect.value : 'none';
  const localVisualFilter = () => {
    const brightness = Number(brightnessRange?.value || 100);
    const touch = Number(touchRange?.value || 0);
    const contrast = 1 + touch / 500;
    const saturation = 1 + touch / 700;
    return `brightness(${brightness}%) contrast(${contrast}) saturate(${saturation})`;
  };

  const normalizeLocalPresentation = () => {
    const filter = localVisualFilter();
    const mirror = Boolean(mirrorToggle?.checked);
    localVideos().forEach(video => {
      if (video.dataset.dsBackgroundProcessed === '1') {
        video.style.filter = filter;
        video.style.transform = mirror ? 'scaleX(-1)' : '';
      }
    });
  };

  const loadSegmenter = async () => {
    if (segmenterPromise) return segmenterPromise;
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import(TASKS_MODULE);
      const vision = await FilesetResolver.forVisionTasks(TASKS_WASM);
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1,1) : document.createElement('canvas');
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        canvas,
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true
      });
    })().catch(error => {
      segmenterPromise = null;
      throw error;
    });
    return segmenterPromise;
  };

  const stopActive = ({stopSource=true,stopOutput=true}={}) => {
    generation += 1;
    const current = active;
    active = null;
    if (!current) return;
    cancelAnimationFrame(current.raf || 0);
    clearTimeout(current.timer);
    if (stopSource) current.sourceTrack?.stop?.();
    if (stopOutput) current.outputTrack?.stop?.();
    current.sourceVideo?.pause?.();
    current.sourceVideo && (current.sourceVideo.srcObject = null);
    localVideos().forEach(video => {
      if (video.dataset.dsBackgroundProcessed === '1') delete video.dataset.dsBackgroundProcessed;
    });
  };

  const buildMaskCanvas = (mask, targetCanvas) => {
    const width = Number(mask?.width || 0);
    const height = Number(mask?.height || 0);
    if (!width || !height) return null;
    if (!targetCanvas || targetCanvas.width !== width || targetCanvas.height !== height) {
      targetCanvas = document.createElement('canvas');
      targetCanvas.width = width;
      targetCanvas.height = height;
    }
    const ctx = targetCanvas.getContext('2d', {willReadFrequently:true});
    const data = mask.getAsFloat32Array();
    const image = ctx.createImageData(width, height);
    for (let i=0,j=0;i<data.length;i+=1,j+=4) {
      const confidence = Math.max(0, Math.min(1, data[i]));
      const feathered = confidence <= .28 ? 0 : confidence >= .72 ? 1 : (confidence-.28)/.44;
      image.data[j] = 255;
      image.data[j+1] = 255;
      image.data[j+2] = 255;
      image.data[j+3] = Math.round(feathered*255);
    }
    ctx.putImageData(image,0,0);
    return targetCanvas;
  };

  const compose = (session, mask) => {
    const {sourceVideo,canvas,ctx,foregroundCanvas,foregroundCtx} = session;
    if (!sourceVideo.videoWidth || !sourceVideo.videoHeight) return;
    if (canvas.width !== sourceVideo.videoWidth || canvas.height !== sourceVideo.videoHeight) {
      canvas.width = sourceVideo.videoWidth;
      canvas.height = sourceVideo.videoHeight;
      foregroundCanvas.width = canvas.width;
      foregroundCanvas.height = canvas.height;
    }
    session.maskCanvas = buildMaskCanvas(mask, session.maskCanvas);
    if (!session.maskCanvas) return;

    const mode = selectedMode();
    const blurPx = mode === 'portrait' ? 22 : 14;
    const brightness = Number(brightnessRange?.value || 100) / 100;
    const touch = Number(touchRange?.value || 0);
    const contrast = 1 + touch / 500;
    const saturation = 1 + touch / 700;

    ctx.save();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.filter = `blur(${blurPx}px) brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    ctx.drawImage(sourceVideo,-blurPx,-blurPx,canvas.width+blurPx*2,canvas.height+blurPx*2);
    ctx.restore();

    foregroundCtx.save();
    foregroundCtx.clearRect(0,0,foregroundCanvas.width,foregroundCanvas.height);
    foregroundCtx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    foregroundCtx.drawImage(sourceVideo,0,0,foregroundCanvas.width,foregroundCanvas.height);
    foregroundCtx.globalCompositeOperation = 'destination-in';
    foregroundCtx.filter = 'blur(1.2px)';
    foregroundCtx.drawImage(session.maskCanvas,0,0,foregroundCanvas.width,foregroundCanvas.height);
    foregroundCtx.restore();

    ctx.drawImage(foregroundCanvas,0,0,canvas.width,canvas.height);
  };

  const bindProcessedPreview = stream => {
    localVideos().forEach(video => {
      if (!video || (video.id === 'stageVideo' && document.body.classList.contains('presentation-active'))) return;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.dataset.dsBackgroundProcessed = '1';
      video.play?.().catch(()=>{});
    });
    normalizeLocalPresentation();
  };

  const startProcessor = async rawStream => {
    const mode = selectedMode();
    if (mode === 'none' || !(rawStream instanceof MediaStream)) return rawStream;
    const rawVideo = rawStream.getVideoTracks()[0];
    if (!rawVideo || rawVideo.readyState !== 'live') return rawStream;

    stopActive();
    const myGeneration = ++generation;
    const sourceTrack = rawVideo.clone();
    const sourceStream = new MediaStream([sourceTrack]);
    const sourceVideo = document.createElement('video');
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    sourceVideo.autoplay = true;
    sourceVideo.srcObject = sourceStream;
    await sourceVideo.play().catch(()=>{});
    if (!sourceVideo.videoWidth) await new Promise(resolve => sourceVideo.addEventListener('loadedmetadata',resolve,{once:true}));

    const canvas = document.createElement('canvas');
    canvas.width = sourceVideo.videoWidth || 1280;
    canvas.height = sourceVideo.videoHeight || 720;
    const ctx = canvas.getContext('2d',{alpha:false,desynchronized:true});
    const foregroundCanvas = document.createElement('canvas');
    foregroundCanvas.width = canvas.width;
    foregroundCanvas.height = canvas.height;
    const foregroundCtx = foregroundCanvas.getContext('2d',{alpha:true,desynchronized:true});
    const outputStream = canvas.captureStream(OUTPUT_FPS);
    const outputTrack = outputStream.getVideoTracks()[0];
    outputTrack.contentHint = 'motion';
    const audioTracks = rawStream.getAudioTracks();
    const publishStream = new MediaStream([outputTrack,...audioTracks]);

    const session = active = {myGeneration,sourceTrack,sourceVideo,canvas,ctx,foregroundCanvas,foregroundCtx,maskCanvas:null,outputTrack,publishStream,lastSegmentAt:0,inFlight:false,raf:0,timer:0};
    const segmenter = await loadSegmenter();
    if (!active || active.myGeneration !== myGeneration) return rawStream;

    const loop = () => {
      if (!active || active.myGeneration !== myGeneration || sourceTrack.readyState !== 'live' || selectedMode()==='none') return;
      const now = performance.now();
      if (!session.inFlight && now-session.lastSegmentAt >= 1000/TARGET_SEGMENT_FPS && sourceVideo.readyState >= 2) {
        session.inFlight = true;
        session.lastSegmentAt = now;
        try {
          segmenter.segmentForVideo(sourceVideo, now, result => {
            try {
              const mask = result?.confidenceMasks?.[0];
              if (mask && active?.myGeneration === myGeneration) compose(session,mask);
              result?.confidenceMasks?.forEach(item=>item.close?.());
              result?.categoryMask?.close?.();
            } finally {
              session.inFlight = false;
            }
          });
        } catch (_) {
          session.inFlight = false;
        }
      }
      session.raf = requestAnimationFrame(loop);
    };
    session.raf = requestAnimationFrame(loop);
    bindProcessedPreview(publishStream);
    return publishStream;
  };

  engine.startMedia = async options => {
    if (wrapping || selectedMode()==='none') return originalStartMedia(options);
    wrapping = true;
    try {
      const rawStream = await originalStartMedia(options);
      const processed = await startProcessor(rawStream);
      if (processed === rawStream) return rawStream;
      const published = await originalStartMedia({...options,existingStream:processed,video:true});
      bindProcessedPreview(published);
      return published;
    } catch (error) {
      stopActive();
      console.warn('DominionStar background segmentation unavailable; retaining raw camera.',error);
      return originalStartMedia(options);
    } finally {
      wrapping = false;
    }
  };

  engine.toggleVideo = async enabled => {
    const target = Boolean(enabled);
    if (!target) stopActive();
    const result = await originalToggleVideo(target);
    if (target && selectedMode()!=='none') {
      setTimeout(async()=>{
        if (wrapping) return;
        const raw = localVideos().map(v=>v.srcObject).find(stream=>stream instanceof MediaStream && stream.getVideoTracks().some(track=>track.readyState==='live'));
        if (raw) {
          wrapping = true;
          try {
            const processed = await startProcessor(raw);
            if (processed !== raw) await originalStartMedia({existingStream:processed,video:true,audio:processed.getAudioTracks().length>0});
          } catch (_) {} finally { wrapping = false; }
        }
      },180);
    }
    return result;
  };

  const refreshMode = async () => {
    if (selectedMode()==='none') {
      stopActive();
      normalizeLocalPresentation();
      return;
    }
    const raw = localVideos().map(v=>v.srcObject).find(stream=>stream instanceof MediaStream && stream.getVideoTracks().some(track=>track.readyState==='live'));
    if (!raw || wrapping) return;
    wrapping = true;
    try {
      const processed = await startProcessor(raw);
      if (processed !== raw) await originalStartMedia({existingStream:processed,video:true,audio:processed.getAudioTracks().length>0});
      bindProcessedPreview(processed);
    } catch (error) {
      console.warn('DominionStar could not enable background segmentation.',error);
    } finally {
      wrapping = false;
    }
  };

  backgroundSelect.addEventListener('change',()=>setTimeout(refreshMode,0),true);
  brightnessRange?.addEventListener('input',normalizeLocalPresentation,true);
  touchRange?.addEventListener('input',normalizeLocalPresentation,true);
  mirrorToggle?.addEventListener('change',normalizeLocalPresentation,true);
  engine.on?.('local-stream',({stream})=>{
    if (selectedMode()!=='none' && stream instanceof MediaStream && !stream.getVideoTracks().includes(active?.outputTrack)) setTimeout(refreshMode,80);
  });

  window.DominionBackgroundEffects2030 = Object.freeze({
    version:'1.0.0',
    refresh:refreshMode,
    stop:()=>stopActive(),
    snapshot:()=>({mode:selectedMode(),active:Boolean(active),sourceState:active?.sourceTrack?.readyState||'none',outputState:active?.outputTrack?.readyState||'none',segmentFps:TARGET_SEGMENT_FPS,outputFps:OUTPUT_FPS,tasksVersion:TASKS_VERSION})
  });
})();
