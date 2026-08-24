(() => {
  'use strict';
  if (window.DominionVideoIntelligenceCompositor) return;

  const engine = window.DominionStarMeetingEngine;
  if (!engine?.startMedia || !engine?.toggleVideo) return;
  const settingsBody = document.querySelector('#settingsDialog .settings-body');
  if (!settingsBody) return;

  const TASKS_VERSION = '1.0.1';
  const TASKS_MODULE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/+esm`;
  const TASKS_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
  const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
  const OUTPUT_FPS = 24;
  const BASE_DETECTION_INTERVAL_MS = 400;
  const MAX_DETECTION_INTERVAL_MS = 1200;
  const MAX_OUTPUT_WIDTH = 1280;
  const MAX_OUTPUT_HEIGHT = 720;
  const PORTRAIT_KEY = 'ds_meet_portrait_lighting';
  const AUTOFRAME_KEY = 'ds_meet_auto_framing';

  const upstreamStartMedia = engine.startMedia.bind(engine);
  const upstreamToggleVideo = engine.toggleVideo.bind(engine);
  let detectorPromise = null;
  let active = null;
  let generation = 0;
  let wrapping = false;
  let latestLocalStream = null;

  const readBool = key => { try { return localStorage.getItem(key) === '1'; } catch (_) { return false; } };
  const writeBool = (key, value) => { try { localStorage.setItem(key, value ? '1' : '0'); } catch (_) {} };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smooth = (current, target, weight = 0.14) => current + (target - current) * weight;

  const installSwitchStyles = () => {
    if (document.querySelector('style[data-ds-modern-setting-switches]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-ds-modern-setting-switches', '1');
    style.textContent = `
      #settingsDialog .check,#settingsDialog .ds-video-intelligence-setting{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:18px!important}
      #settingsDialog .check>input[type="checkbox"],#settingsDialog .ds-video-intelligence-setting>input[type="checkbox"]{
        appearance:none!important;-webkit-appearance:none!important;flex:0 0 46px!important;width:46px!important;height:26px!important;margin:0!important;border:1px solid #ffffff2a!important;border-radius:999px!important;cursor:pointer!important;outline:none!important;
        background-color:#263244!important;background-image:radial-gradient(circle at 13px 50%,#f7f9fc 0 8px,transparent 8.5px)!important;background-repeat:no-repeat!important;
        box-shadow:inset 0 1px 3px #0008!important;transition:background-color .18s ease,background-image .18s ease,border-color .18s ease,box-shadow .18s ease!important
      }
      #settingsDialog .check>input[type="checkbox"]:checked,#settingsDialog .ds-video-intelligence-setting>input[type="checkbox"]:checked{
        background-color:#2f80ed!important;background-image:radial-gradient(circle at 33px 50%,#fff 0 8px,transparent 8.5px)!important;border-color:#55a2ff!important;box-shadow:0 0 0 3px #2f80ed22,inset 0 1px 3px #0005!important
      }
      #settingsDialog .check>input[type="checkbox"]:focus-visible,#settingsDialog .ds-video-intelligence-setting>input[type="checkbox"]:focus-visible{box-shadow:0 0 0 3px #7bb6ff66!important}
    `;
    document.head.append(style);
  };
  installSwitchStyles();

  const createToggle = (id, label, description, checked) => {
    let input = document.getElementById(id);
    if (input) return input;
    const row = document.createElement('label');
    row.className = 'check ds-video-intelligence-setting';
    row.innerHTML = `<span><strong>${label}</strong><small style="display:block;opacity:.68;margin-top:3px">${description}</small></span>`;
    input = document.createElement('input');
    input.id = id;
    input.type = 'checkbox';
    input.checked = Boolean(checked);
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-label', label);
    row.append(input);
    settingsBody.append(row);
    return input;
  };

  const portraitToggle = createToggle('portraitLightingToggle','Portrait lighting','Brighten you while gently dimming the surrounding scene.',readBool(PORTRAIT_KEY));
  const autoFrameToggle = createToggle('autoFramingToggle','Auto-framing','Keep you centered smoothly without interrupting the meeting.',readBool(AUTOFRAME_KEY));
  const enabled = () => Boolean(portraitToggle.checked || autoFrameToggle.checked);
  const isTaggedTrack = track => Boolean(track?.__dsVideoIntelligence === true);

  const localVideos = () => ['prejoinVideo','selfVideo','stageVideo'].map(id => document.getElementById(id)).filter(Boolean);
  const updateLocalPreview = stream => {
    localVideos().forEach(video => {
      if (video.id === 'stageVideo' && document.body.classList.contains('presentation-active')) return;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.dataset.dsVideoIntelligence = '1';
      video.play?.().catch(() => {});
    });
  };
  const clearLocalPreviewMarker = () => localVideos().forEach(video => { if (video.dataset.dsVideoIntelligence === '1') delete video.dataset.dsVideoIntelligence; });

  const loadDetector = async () => {
    if (detectorPromise) return detectorPromise;
    detectorPromise = (async () => {
      const { FilesetResolver, FaceDetector } = await import(TASKS_MODULE);
      const vision = await FilesetResolver.forVisionTasks(TASKS_WASM);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.58
      });
    })().catch(error => { detectorPromise = null; throw error; });
    return detectorPromise;
  };

  const stopSession = ({ stopSource = true, stopOutput = true } = {}) => {
    generation += 1;
    const session = active;
    active = null;
    if (!session) return null;
    cancelAnimationFrame(session.raf || 0);
    session.sourceVideo?.pause?.();
    if (session.sourceVideo) session.sourceVideo.srcObject = null;
    if (stopSource && session.sourceTrack?.readyState !== 'ended') session.sourceTrack.stop();
    if (stopOutput && session.outputTrack?.readyState !== 'ended') session.outputTrack.stop();
    clearLocalPreviewMarker();
    return session;
  };

  const normalizeDetection = (detection, width, height) => {
    const box = detection?.boundingBox;
    if (!box || !width || !height) return null;
    const x = clamp(Number(box.originX || 0) / width, 0, 1);
    const y = clamp(Number(box.originY || 0) / height, 0, 1);
    const w = clamp(Number(box.width || 0) / width, 0.02, 1);
    const h = clamp(Number(box.height || 0) / height, 0.02, 1);
    return { cx: clamp(x + w / 2, 0, 1), cy: clamp(y + h / 2, 0, 1), w, h };
  };

  const updateSubject = (session, detected) => {
    if (!detected) {
      session.missedFrames += 1;
      if (session.missedFrames > 10) session.subject = null;
      return;
    }
    session.missedFrames = 0;
    if (!session.subject) { session.subject = detected; return; }
    session.subject = {
      cx: smooth(session.subject.cx, detected.cx),
      cy: smooth(session.subject.cy, detected.cy),
      w: smooth(session.subject.w, detected.w),
      h: smooth(session.subject.h, detected.h)
    };
  };

  const cropForSubject = (session, width, height) => {
    const subject = session.subject;
    if (!autoFrameToggle.checked || !subject) return { sx:0, sy:0, sw:width, sh:height };
    const aspect = width / height;
    const desiredWidth = clamp(subject.w * 4.8, 0.58, 1);
    let sw = width * desiredWidth;
    let sh = sw / aspect;
    if (sh > height) { sh = height; sw = sh * aspect; }
    const targetCx = subject.cx * width;
    const targetCy = clamp(subject.cy + subject.h * .38, .30, .70) * height;
    return {
      sx: clamp(targetCx - sw / 2, 0, width - sw),
      sy: clamp(targetCy - sh * .43, 0, height - sh),
      sw, sh
    };
  };

  const subjectInOutput = (session, crop, outWidth, outHeight) => {
    if (!session.subject) return null;
    const srcWidth = session.sourceVideo.videoWidth || outWidth;
    const srcHeight = session.sourceVideo.videoHeight || outHeight;
    const px = session.subject.cx * srcWidth;
    const py = session.subject.cy * srcHeight;
    return {
      cx: ((px - crop.sx) / crop.sw) * outWidth,
      cy: ((py - crop.sy) / crop.sh) * outHeight,
      faceW: (session.subject.w * srcWidth / crop.sw) * outWidth,
      faceH: (session.subject.h * srcHeight / crop.sh) * outHeight
    };
  };

  const drawFrame = session => {
    const { sourceVideo, canvas, ctx } = session;
    const srcWidth = sourceVideo.videoWidth;
    const srcHeight = sourceVideo.videoHeight;
    if (!srcWidth || !srcHeight) return;
    const crop = cropForSubject(session, srcWidth, srcHeight);
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = portraitToggle.checked && session.subject ? 'brightness(.80) saturate(.96)' : 'none';
    ctx.drawImage(sourceVideo, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (portraitToggle.checked && session.subject) {
      const mapped = subjectInOutput(session, crop, canvas.width, canvas.height);
      if (mapped) {
        const radiusX = clamp(mapped.faceW * 2.7, canvas.width * .16, canvas.width * .34);
        const radiusY = clamp(mapped.faceH * 3.8, canvas.height * .28, canvas.height * .55);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(mapped.cx, mapped.cy + radiusY * .24, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.filter = 'brightness(1.18) saturate(1.04)';
        ctx.drawImage(sourceVideo, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }
  };

  const outputSize = (width, height) => {
    let w = Math.max(320, Number(width) || 1280);
    let h = Math.max(180, Number(height) || 720);
    const scale = Math.min(1, MAX_OUTPUT_WIDTH / w, MAX_OUTPUT_HEIGHT / h);
    return { width: Math.max(320, Math.round(w * scale)), height: Math.max(180, Math.round(h * scale)) };
  };

  const buildProcessedStream = async sourceStream => {
    if (!(sourceStream instanceof MediaStream) || !enabled()) return sourceStream;
    const rawTrack = sourceStream.getVideoTracks()[0];
    if (!rawTrack || rawTrack.readyState !== 'live' || isTaggedTrack(rawTrack)) return sourceStream;

    stopSession();
    const myGeneration = ++generation;
    const sourceTrack = rawTrack.clone();
    const sourceVideo = document.createElement('video');
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    sourceVideo.autoplay = true;
    sourceVideo.srcObject = new MediaStream([sourceTrack]);
    await sourceVideo.play().catch(() => {});
    if (!sourceVideo.videoWidth) {
      await Promise.race([
        new Promise(resolve => sourceVideo.addEventListener('loadedmetadata', resolve, { once:true })),
        new Promise(resolve => setTimeout(resolve, 900))
      ]);
    }

    const rawSettings = rawTrack.getSettings?.() || {};
    const sourceWidth = sourceVideo.videoWidth || Number(rawSettings.width) || 1280;
    const sourceHeight = sourceVideo.videoHeight || Number(rawSettings.height) || 720;
    const size = outputSize(sourceWidth, sourceHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { alpha:false, desynchronized:true });
    if (!ctx || typeof canvas.captureStream !== 'function') { sourceTrack.stop(); return sourceStream; }

    const outputStream = canvas.captureStream(OUTPUT_FPS);
    const outputTrack = outputStream.getVideoTracks()[0];
    if (!outputTrack) { sourceTrack.stop(); return sourceStream; }
    outputTrack.contentHint = 'motion';
    outputTrack.__dsVideoIntelligence = true;
    outputTrack.__dsPhysicalSourceTrack = sourceTrack;
    outputTrack.__dsPhysicalSourceDeviceId = String(rawSettings.deviceId || '');
    outputTrack.__dsPhysicalSourceLabel = String(rawTrack.label || sourceTrack.label || '');

    const audioTracks = sourceStream.getAudioTracks().filter(track => track.readyState === 'live');
    const publishStream = new MediaStream([outputTrack, ...audioTracks]);
    const session = active = {
      myGeneration, sourceTrack, sourceVideo, canvas, ctx, outputTrack, publishStream, audioTracks,
      subject:null, missedFrames:0, inFlight:false, lastDetectAt:0, lastDrawAt:0,
      detectionIntervalMs:BASE_DETECTION_INTERVAL_MS, detector:null, raf:0,
      slowDetections:0, detectionMs:0
    };

    loadDetector().then(detector => { if (active?.myGeneration === myGeneration) session.detector = detector; }).catch(() => {});

    const loop = now => {
      if (!active || active.myGeneration !== myGeneration || sourceTrack.readyState !== 'live') return;
      if (sourceVideo.readyState >= 2 && now - session.lastDrawAt >= 1000 / OUTPUT_FPS) {
        session.lastDrawAt = now;
        drawFrame(session);
      }
      if (session.detector && !session.inFlight && sourceVideo.readyState >= 2 && now - session.lastDetectAt >= session.detectionIntervalMs) {
        session.inFlight = true;
        session.lastDetectAt = now;
        const started = performance.now();
        try {
          const result = session.detector.detectForVideo(sourceVideo, now);
          updateSubject(session, normalizeDetection(result?.detections?.[0], sourceVideo.videoWidth, sourceVideo.videoHeight));
        } catch (_) {
          updateSubject(session, null);
        } finally {
          session.detectionMs = performance.now() - started;
          if (session.detectionMs > 120) session.slowDetections += 1;
          else session.slowDetections = Math.max(0, session.slowDetections - 1);
          if (session.slowDetections >= 2) session.detectionIntervalMs = Math.min(MAX_DETECTION_INTERVAL_MS, Math.round(session.detectionIntervalMs * 1.6));
          else if (session.detectionMs < 55 && session.detectionIntervalMs > BASE_DETECTION_INTERVAL_MS) session.detectionIntervalMs = Math.max(BASE_DETECTION_INTERVAL_MS, session.detectionIntervalMs - 80);
          session.inFlight = false;
        }
      }
      session.raf = requestAnimationFrame(loop);
    };
    session.raf = requestAnimationFrame(loop);
    updateLocalPreview(publishStream);
    return publishStream;
  };

  const publishProcessed = async (sourceStream, options = {}, { throughCurrentPipeline = false } = {}) => {
    const processed = await buildProcessedStream(sourceStream);
    if (processed === sourceStream) return sourceStream;
    const publish = throughCurrentPipeline ? engine.startMedia.bind(engine) : upstreamStartMedia;
    const result = await publish({ ...options, existingStream: processed, video:true, audio:processed.getAudioTracks().length > 0 });
    updateLocalPreview(result);
    return result;
  };

  engine.startMedia = async options => {
    if (wrapping || options?.existingStream instanceof MediaStream) return upstreamStartMedia(options);
    wrapping = true;
    try {
      const source = await upstreamStartMedia(options);
      latestLocalStream = source;
      if (!enabled()) return source;
      return await publishProcessed(source, options, { throughCurrentPipeline:false });
    } catch (error) {
      stopSession();
      throw error;
    } finally { wrapping = false; }
  };

  engine.toggleVideo = async enabledState => {
    const result = await upstreamToggleVideo(enabledState);
    if (!enabledState) {
      stopSession();
      return result;
    }
    if (!enabled()) return result;
    setTimeout(async () => {
      if (wrapping) return;
      const candidate = latestLocalStream instanceof MediaStream && latestLocalStream.getVideoTracks().some(track => track.readyState === 'live')
        ? latestLocalStream
        : localVideos().map(video => video.srcObject).find(stream => stream instanceof MediaStream && stream.getVideoTracks().some(track => track.readyState === 'live' && !isTaggedTrack(track)));
      if (!candidate) return;
      wrapping = true;
      try { await publishProcessed(candidate, { video:true, audio:candidate.getAudioTracks().length > 0 }, { throughCurrentPipeline:true }); }
      catch (_) {}
      finally { wrapping = false; }
    }, 180);
    return result;
  };

  const restoreOrRefresh = async () => {
    writeBool(PORTRAIT_KEY, portraitToggle.checked);
    writeBool(AUTOFRAME_KEY, autoFrameToggle.checked);
    if (wrapping) return;
    const current = active;
    if (!enabled()) {
      if (!current?.sourceTrack || current.sourceTrack.readyState !== 'live') { stopSession(); return; }
      wrapping = true;
      active = null;
      generation += 1;
      cancelAnimationFrame(current.raf || 0);
      const restore = new MediaStream([current.sourceTrack, ...(current.audioTracks || []).filter(track => track.readyState === 'live')]);
      try {
        await engine.startMedia({ existingStream:restore, video:true, audio:restore.getAudioTracks().length > 0 });
        if (current.outputTrack?.readyState !== 'ended') current.outputTrack.stop();
      } catch (_) {
        if (current.sourceTrack?.readyState !== 'ended') current.sourceTrack.stop();
      } finally {
        current.sourceVideo?.pause?.();
        if (current.sourceVideo) current.sourceVideo.srcObject = null;
        clearLocalPreviewMarker();
        wrapping = false;
      }
      return;
    }

    const candidate = current?.sourceTrack?.readyState === 'live'
      ? new MediaStream([current.sourceTrack, ...(current.audioTracks || []).filter(track => track.readyState === 'live')])
      : latestLocalStream;
    if (!(candidate instanceof MediaStream) || !candidate.getVideoTracks().some(track => track.readyState === 'live')) return;
    wrapping = true;
    try { await publishProcessed(candidate, { video:true, audio:candidate.getAudioTracks().length > 0 }, { throughCurrentPipeline:true }); }
    catch (_) {}
    finally { wrapping = false; }
  };

  portraitToggle.addEventListener('change', () => { void restoreOrRefresh(); });
  autoFrameToggle.addEventListener('change', () => { void restoreOrRefresh(); });

  window.DominionVideoIntelligenceCompositor = Object.freeze({
    version:'2.0.0',
    processing:'on-device',
    getSourceTrack:() => active?.sourceTrack?.readyState === 'live' ? active.sourceTrack : null,
    getProcessedTrack:() => active?.outputTrack?.readyState === 'live' ? active.outputTrack : null,
    snapshot:() => ({
      active:Boolean(active),
      portraitLighting:Boolean(portraitToggle.checked),
      autoFraming:Boolean(autoFrameToggle.checked),
      processing:'on-device',
      outputFps:OUTPUT_FPS,
      detectionIntervalMs:active?.detectionIntervalMs || BASE_DETECTION_INTERVAL_MS,
      lastDetectionMs:Math.round(active?.detectionMs || 0),
      outputWidth:active?.canvas?.width || 0,
      outputHeight:active?.canvas?.height || 0
    })
  });
})();
