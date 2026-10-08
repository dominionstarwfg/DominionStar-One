(() => {
  'use strict';
  if (window.DominionRemoteShareWatchdog) return;

  const engine = window.DominionStarMeetingEngine;
  const stageVideo = document.getElementById('stageVideo');
  const stageFallback = document.getElementById('stageFallback');
  const stageName = document.getElementById('stageName');
  if (!engine?.on || !stageVideo) return;

  const streams = new Map();
  const active = new Set();
  const recovery = new Map();
  const WATCH_MS = 850;
  const STALL_MS = 1800;
  const MAX_RESYNCS = 2;

  const stateFor = participantId => {
    let item = recovery.get(participantId);
    if (!item) {
      item = {timer:null,lastTime:-1,lastAdvanceAt:0,resyncs:0,rebinds:0};
      recovery.set(participantId,item);
    }
    return item;
  };

  const liveVideoTrack = stream => stream?.getVideoTracks?.().find(track => track.readyState === 'live' && track.enabled !== false) || null;

  const clearWatch = participantId => {
    const item = recovery.get(participantId);
    if (item?.timer) clearTimeout(item.timer);
    if (item) item.timer = null;
  };

  const rebindStage = participantId => {
    const stream = streams.get(participantId);
    const track = liveVideoTrack(stream);
    if (!track || !active.has(participantId)) return false;
    const item = stateFor(participantId);
    const isolated = new MediaStream([track, ...(stream.getAudioTracks?.() || []).filter(audio => audio.readyState === 'live')]);
    stageVideo.srcObject = null;
    stageVideo.srcObject = isolated;
    stageVideo.muted = false;
    stageVideo.autoplay = true;
    stageVideo.playsInline = true;
    stageVideo.hidden = false;
    stageFallback && (stageFallback.hidden = true);
    Promise.resolve(stageVideo.play?.()).catch(() => {});
    item.rebinds += 1;
    return true;
  };

  const scheduleWatch = participantId => {
    clearWatch(participantId);
    if (!active.has(participantId)) return;
    const item = stateFor(participantId);
    if (!item.lastAdvanceAt) item.lastAdvanceAt = Date.now();
    item.timer = setTimeout(async () => {
      item.timer = null;
      if (!active.has(participantId)) return;
      const stream = streams.get(participantId);
      const track = liveVideoTrack(stream);
      if (!track) {
        if (item.resyncs < MAX_RESYNCS) {
          item.resyncs += 1;
          await engine.requestMediaResync?.(participantId).catch(() => {});
        }
        scheduleWatch(participantId);
        return;
      }

      const current = Number(stageVideo.currentTime || 0);
      const stageOwnsTrack = stageVideo.srcObject?.getVideoTracks?.().some(candidate => candidate.id === track.id);
      if (stageOwnsTrack && current > item.lastTime + 0.01) {
        item.lastTime = current;
        item.lastAdvanceAt = Date.now();
        scheduleWatch(participantId);
        return;
      }

      const stalledFor = Date.now() - item.lastAdvanceAt;
      if (!stageOwnsTrack || stalledFor >= STALL_MS) {
        rebindStage(participantId);
        if (item.resyncs < MAX_RESYNCS) {
          item.resyncs += 1;
          await engine.requestMediaResync?.(participantId).catch(() => {});
        }
        item.lastTime = Number(stageVideo.currentTime || 0);
        item.lastAdvanceAt = Date.now();
      }
      scheduleWatch(participantId);
    }, WATCH_MS);
  };

  engine.on('remote-screen-stream', ({participantId,stream}) => {
    if (!participantId || !stream) return;
    streams.set(participantId,stream);
    const item = stateFor(participantId);
    item.lastTime = -1;
    item.lastAdvanceAt = Date.now();
    item.resyncs = 0;
    if (active.has(participantId)) {
      requestAnimationFrame(() => {
        const track = liveVideoTrack(stream);
        const stageOwnsTrack = track && stageVideo.srcObject?.getVideoTracks?.().some(candidate => candidate.id === track.id);
        if (!stageOwnsTrack) rebindStage(participantId);
        scheduleWatch(participantId);
      });
    }
  });

  engine.on('screen-state', payload => {
    const participantId = payload?.participantId;
    if (!participantId) return;
    if (payload.active) {
      active.add(participantId);
      const item = stateFor(participantId);
      item.lastTime = -1;
      item.lastAdvanceAt = Date.now();
      item.resyncs = 0;
      if (stageName && !streams.has(participantId)) stageName.textContent = `${payload.displayName || 'Participant'} is starting screen share…`;
      scheduleWatch(participantId);
    } else {
      active.delete(participantId);
      clearWatch(participantId);
      streams.delete(participantId);
      recovery.delete(participantId);
    }
  });

  window.DominionRemoteShareWatchdog = Object.freeze({
    version:'1.0.0',
    snapshot:() => ({
      active:[...active],
      streams:[...streams.keys()],
      recovery:[...recovery.entries()].map(([participantId,item]) => ({participantId,resyncs:item.resyncs,rebinds:item.rebinds,lastAdvanceAt:item.lastAdvanceAt}))
    })
  });
})();