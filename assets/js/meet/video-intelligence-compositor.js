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
  const DETECTION_FPS = 10;
  const OUTPUT_FPS = 30;
  const PORTRAIT_KEY = 'ds_meet_portrait_lighting';
  const AUTOFRAME_KEY = 'ds_meet_auto_framing';

  const upstreamStartMedia = engine.startMedia.bind(engine);
  const upstreamToggleVideo = engine.toggleVideo.bind(engine);
  let detectorPromise = null;
  let active = null;
  let generation = 0;
  let wrapping = false;
  let latestLocalStream = null;

  const readBool = key => {
    try { return localStorage.getItem(key) === '1'; } catch (_) { return false; }
  };
  const writeBool = (key, value) => {
    try { localStorage.setItem(key, value ? '1' : '0'); } catch (_) {}
  };

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
    row.append(input);
    settingsBody.append(row);
    return input;
  };

  const portraitToggle = createToggle(
    'portraitLightingToggle',
    'Portrait lighting',
    'Brighten you while gently dimming the surrounding scene.',
    readBool(PORTRAIT_KEY)
  );
  const autoFrameToggle = createToggle(
    'autoFramingToggle',
    'Auto-framing',
    'Keep you centered as you move closer, farther away, or shift in your seat.',
    readBool(AUTOFRAME_KEY)
  );

  const enabled = () => Boolean(portraitToggle.checked || autoFrameToggle.checked);
  const isTaggedTrack = track => Boolean(track?.__dsVideoIntelligence === true);

  const localVideos = () => [
    document.getElementById('prejoinVideo'),
    document.getElementById('selfVideo'),
    document.getElementById('stageVideo')
  ].filter(Boolean);

  const updateLocalPreview = stream => {
    localVideos().forEach(video => {
      if (!video || (video.id === 'stageVideo' && document.body.classList.contains('presentation-active'))) return;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.dataset.dsVideoIntelligence = '1';
      video.play?.().catch(() => {});
    });
  };

  const clearLocalPreviewMarker = () => {
    localVideos().forEach(video => {
      if (video.dataset.dsVideoIntelligence === '1') delete video.dataset.dsVideoIntelligence;
    });
  };

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
    })().catch(error => {
      detectorPromise = null;
      throw error;
    });
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

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smooth = (current, target, weight = 0.18) => current + (target - current) * weight;

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
      if (session.missedFrames > 18) session.subject = null;
      return;
    }
    session.missedFrames = 0;
    if (!session.subject) {
      session.subject = detected;
      return;
    }
    session.subject = {
      cx: smooth(session.subject.cx, detected.cx),
      cy: smooth(session.subject.cy, detected.cy),
      w: smooth(session.subject.w, detected.w),
      h: smooth(session.subject.h, detected.h)
    };
  };

  const cropForSubject = (session, width, height) => {
    const subject = session.subject;
    if (!autoFrameToggle.checked || !subject) return { sx: 0, sy: 0, sw: width, sh: height };
    const aspect = width / height;
    const desiredWidth = clamp(subject.w * 4.6, 0.52, 1);
    let sw = width * desiredWidth;
    let sh = sw / aspect;
    if (sh > height) {
      sh = height;
      sw = sh * aspect;
    }
    const targetCx = subject.cx * width;
    const targetCy = clamp(subject.cy + subject.h * 0.42, 0.28, 0.72) * height;
    const sx = clamp(targetCx - sw / 2, 0, width - sw);
    const sy = clamp(targetCy - sh * 0.42, 0, height - sh);
    return { sx, sy, sw, sh };
  };

  const subjectInOutput = (session, crop, outWidth, outHeight) => {
    if (!session.subject) return null;
    const srcWidth = session.sourceVideo.videoWidth || outWidth;
    const srcHeight = session.sourceVideo.videoHeight || outHeight;
    const px = session.subject.cx * srcWidth;
    const py = session.subject.cy * srcHeight;
    const cx = ((px - crop.sx) / crop.sw) * outWidth;
    const cy = ((py - crop.sy) / crop.sh) * outHeight;
    const faceW = (session.subject.w * srcWidth / crop.sw) * outWidth;
    const faceH = (session.subject.h * srcHeight / crop.sh) * outHeight;
    return { cx, cy, faceW, faceH };
  };

  const drawFrame = session => {
    const { sourceVideo, canvas, ctx } = session;
    const srcWidth = sourceVideo.videoWidth;
    const srcHeight = sourceVideo.videoHeight;
    if (!srcWidth || !srcHeight) return;
    if (canvas.width !== srcWidth || canvas.height !== srcHeight) {
      canvas.width = srcWidth;
      canvas.height = srcHeight;
    }
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
        new Promise(resolve => sourceVideo.addEventListener('loadedmetadata', resolve, { once: true })),
        new Promise(resolve => setTimeout(resolve, 1200))
      ]);
    }

    const canvas = document.createElement('canvas');
    canvas.width = sourceVideo.videoWidth || Number(rawTrack.getSettings?.().width) || 1280;
    canvas.height = sourceVideo.videoHeight || Number(rawTrack.getSettings?.().height) || 720;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx || typeof canvas.captureStream !== 'function') {
      sourceTrack.stop();
      return sourceStream;
    }
    const outputStream = canvas.captureStream(OUTPUT_FPS);
    const outputTrack = outputStream.getVideoTracks()[0];
    if (!outputTrack) {
      sourceTrack.stop();
      return sourceStream;
    }
    outputTrack.contentHint = 'motion';
    outputTrack.__dsVideoIntelligence = true;
    const audioTracks = sourceStream.getAudioTracks().filter(track => track.readyState === 'live');
    const publishStream = new MediaStream([outputTrack, ...audioTracks]);
    const session = active = {
      myGeneration,
      sourceTrack,
      sourceVideo,
      canvas,
      ctx,
      outputTrack,
      publishStream,
      audioTracks,
      subject: null,
      missedFrames: 0,
      inFlight: false,
      lastDetectAt: 0,
      raf: 0
    };

    let detector = null;
    try { detector = await loadDetector(); } catch (_) {}

    const loop = () => {
      if (!active || active.myGeneration !== myGeneration || sourceTrack.readyState !== 'live') return;
      const now = performance.now();
      if (detector && !session.inFlight && now - session.lastDetectAt >= 1000 / DETECTION_FPS && sourceVideo.readyState >= 2) {
        session.inFlight = true;
        session.lastDetectAt = now;
        try {
          const result = detector.detectForVideo(sourceVideo, now);
          const detected = normalizeDetection(result?.detections?.[0], sourceVideo.videoWidth, sourceVideo.videoHeight);
          updateSubject(session, detected);
        } catch (_) {
          updateSubject(session, null);
        } finally {
          session.inFlight = false;
        }
      }
      drawFrame(session);
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
    const result = await publish({ ...options, existingStream: processed, video: true, audio: processed.getAudioTracks().length > 0 });
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
      return await publishProcessed(source, options, { throughCurrentPipeline: false });
    } catch (error) {
      stopSession();
      throw error;
    } finally {
      wrapping = false;
    }
  };

  engine.toggleVideo = async enabledState => {
    const result = await upstreamToggleVideo(enabledState);
    if (!enabledState || !enabled()) {
      if (!enabledState) stopSession();
      return result;
    }
    setTimeout(async () => {
      if (wrapping) return;
      const candidate = latestLocalStream instanceof MediaStream
        && latestLocalStream.getVideoTracks().some(track => track.readyState === 'live')
        ? latestLocalStream
        : localVideos().map(video => video.srcObject).find(stream => stream instanceof MediaStream && stream.getVideoTracks().some(track => track.readyState === 'live' && !isTaggedTrack(track)));
      if (!candidate) return;
      wrapping = true;
      try { await publishProcessed(candidate, { video: true, audio: candidate.getAudioTracks().length > 0 }, { throughCurrentPipeline: true }); }
      catch (_) {}
      finally { wrapping = false; }
    }, 220);
    return result;
  };

  const restoreOrRefresh = async () => {
    if (wrapping) return;
    writeBool(PORTRAIT_KEY, portraitToggle.checked);
    writeBool(AUTOFRAME_KEY, autoFrameToggle.checked);
    const current = active;
    if (!enabled()) {
      if (!current?.sourceTrack || current.sourceTrack.readyState !== 'live') {
        stopSession();
        return;
      }
      wrapping = true;
      active = null;
      generation += 1;
      cancelAnimationFrame(current.raf || 0);
      const restore = new MediaStream([current.sourceTrack, ...(current.audioTracks || []).filter(track => track.readyState === 'live')]);
      try {
        await engine.startMedia({ existingStream: restore, video: true, audio: restore.getAudioTracks().length > 0 });
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

    const sourceTrack = current?.sourceTrack?.readyState === 'live' ? current.sourceTrack : null;
    const audioTracks = (current?.audioTracks || []).filter(track => track.readyState === 'live');
    const fallback = latestLocalStream instanceof MediaStream ? latestLocalStream : null;
    const source = sourceTrack ? new MediaStream([sourceTrack, ...audioTracks]) : fallback;
    if (!source?.getVideoTracks?.().some(track => track.readyState === 'live')) return;
    wrapping = true;
    try {
      const processed = await buildProcessedStream(source);
      if (processed !== source) await engine.startMedia({ existingStream: processed, video: true, audio: processed.getAudioTracks().length > 0 });
    } catch (_) {} finally { wrapping = false; }
  };

  portraitToggle.addEventListener('change', () => { void restoreOrRefresh(); });
  autoFrameToggle.addEventListener('change', () => { void restoreOrRefresh(); });

  engine.on?.('local-stream', ({ stream }) => {
    if (stream instanceof MediaStream && !stream.getVideoTracks().some(isTaggedTrack)) latestLocalStream = stream;
  });
  engine.on?.('local-media-state', ({ stream }) => {
    if (stream instanceof MediaStream && !stream.getVideoTracks().some(isTaggedTrack)) latestLocalStream = stream;
  });

  window.DominionVideoIntelligenceCompositor = Object.freeze({
    version: '1.0.0',
    refresh: restoreOrRefresh,
    isActive: () => Boolean(active),
    snapshot: () => ({
      portraitLighting: Boolean(portraitToggle.checked),
      autoFraming: Boolean(autoFrameToggle.checked),
      active: Boolean(active),
      subjectTracked: Boolean(active?.subject),
      sourceState: active?.sourceTrack?.readyState || 'none',
      outputState: active?.outputTrack?.readyState || 'none',
      detectionFps: DETECTION_FPS,
      outputFps: OUTPUT_FPS,
      tasksVersion: TASKS_VERSION,
      faceModelUrl: FACE_MODEL_URL,
      processing: 'on-device'
    })
  });
})();
