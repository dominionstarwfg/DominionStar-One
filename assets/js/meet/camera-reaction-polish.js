(() => {
  'use strict';
  if (window.DominionCameraReactionPolish) return;

  const $ = id => document.getElementById(id);
  const cameraSelect = $('cameraSelect');
  const microphoneSelect = $('microphoneSelect');
  const speakerSelect = $('speakerSelect');
  const settingsDialog = $('settingsDialog');
  const qualitySelect = $('qualitySelect');
  const reactionLayer = $('reactionLayer');
  if (!cameraSelect || !microphoneSelect) return;

  const style = document.createElement('style');
  style.dataset.dsCameraReactionPolish = '1';
  style.textContent = `
    #reactionLayer.reaction-layer{pointer-events:none!important;background:transparent!important;box-shadow:none!important;border:0!important;}
    #reactionLayer .floating-reaction{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0!important;min-width:0!important;overflow:visible!important;}
    #reactionLayer .floating-reaction-symbol{display:block!important;font-size:42px!important;line-height:1!important;background:transparent!important;border:0!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.22));}
    #reactionLayer .floating-reaction-name{display:none!important;}
    #reactionLayer .reaction-burst-particle{background:transparent!important;border:0!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.18));}
    .settings-device-status{display:block;margin:-4px 0 8px;color:#91a2b8;font-size:11px;line-height:1.35;}
  `;
  document.head.append(style);

  const currentTracks = () => {
    const nodes = [$('prejoinVideo'), $('selfVideo'), $('stageVideo')];
    const tracks = [];
    for (const node of nodes) {
      const stream = node?.srcObject;
      if (!stream?.getTracks) continue;
      for (const track of stream.getTracks()) if (track?.readyState === 'live') tracks.push(track);
    }
    return tracks;
  };

  const hardwareVideoTrack = () => {
    const segmentedSource = window.DominionBackgroundEffects2030?.getSourceTrack?.();
    if (segmentedSource?.readyState === 'live') return segmentedSource;
    return currentTracks().find(item => item.kind === 'video') || null;
  };

  const currentTrackLabel = kind => {
    const mediaKind = kind === 'videoinput' ? 'video' : kind === 'audioinput' ? 'audio' : '';
    if (!mediaKind) return '';
    const track = mediaKind === 'video'
      ? hardwareVideoTrack()
      : currentTracks().find(item => item.kind === mediaKind && String(item.label || '').trim());
    return String(track?.label || '').trim();
  };

  const fallbackPrefix = kind => kind === 'videoinput' ? 'Camera' : kind === 'audioinput' ? 'Microphone' : 'Speaker';

  const hydrateSelect = (select, devices, kind) => {
    if (!select) return;
    const selected = select.value;
    const matching = devices.filter(device => device.kind === kind && device.deviceId);
    const existingById = new Map([...select.options].map(option => [option.value, option]));
    const activeLabel = currentTrackLabel(kind);

    for (let index = 0; index < matching.length; index += 1) {
      const device = matching[index];
      let option = existingById.get(device.deviceId);
      if (!option) {
        option = document.createElement('option');
        option.value = device.deviceId;
        select.append(option);
      }
      const realLabel = String(device.label || '').trim();
      const isSelected = device.deviceId === selected;
      option.textContent = realLabel || (isSelected && activeLabel) || `${fallbackPrefix(kind)} ${index + 1} — name unavailable`;
      option.dataset.deviceLabelResolved = realLabel || (isSelected && activeLabel) ? '1' : '0';
    }

    [...select.options].forEach(option => {
      if (option.value && !matching.some(device => device.deviceId === option.value)) option.remove();
    });
    if (selected && matching.some(device => device.deviceId === selected)) select.value = selected;
  };

  const refreshDeviceNames = async ({retry = true} = {}) => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    let devices = await navigator.mediaDevices.enumerateDevices();
    hydrateSelect(cameraSelect, devices, 'videoinput');
    hydrateSelect(microphoneSelect, devices, 'audioinput');
    hydrateSelect(speakerSelect, devices, 'audiooutput');

    const unresolved = devices.some(device => ['videoinput','audioinput'].includes(device.kind) && device.deviceId && !String(device.label || '').trim());
    if (retry && unresolved && currentTracks().length) {
      await new Promise(resolve => setTimeout(resolve, 260));
      devices = await navigator.mediaDevices.enumerateDevices();
      hydrateSelect(cameraSelect, devices, 'videoinput');
      hydrateSelect(microphoneSelect, devices, 'audioinput');
      hydrateSelect(speakerSelect, devices, 'audiooutput');
    }
    return devices;
  };

  const applyVideoQuality = async () => {
    const quality = String(qualitySelect?.value || '720');
    const height = quality === '1080' ? 1080 : 720;
    const width = quality === '1080' ? 1920 : 1280;
    const track = hardwareVideoTrack();
    if (!track?.applyConstraints) return false;
    try {
      await track.applyConstraints({width:{ideal:width},height:{ideal:height},frameRate:{ideal:30,max:30}});
      if (window.DominionBackgroundEffects2030?.isActive?.()) {
        setTimeout(() => window.DominionBackgroundEffects2030?.refresh?.(), 0);
      }
      return true;
    } catch (error) {
      console.warn('DominionStar requested video quality is not available on this camera', error);
      return false;
    }
  };

  const addStatus = () => {
    if (!settingsDialog || settingsDialog.querySelector('.settings-device-status')) return;
    const cameraLabel = cameraSelect.closest('label');
    if (!cameraLabel) return;
    const status = document.createElement('small');
    status.className = 'settings-device-status';
    status.textContent = 'DominionStar shows the hardware names reported by macOS after camera and microphone permission is granted.';
    cameraLabel.insertAdjacentElement('afterend', status);
  };

  const refreshSoon = () => {
    refreshDeviceNames().catch(() => {});
    setTimeout(() => refreshDeviceNames().catch(() => {}), 450);
  };

  navigator.mediaDevices?.addEventListener?.('devicechange', refreshSoon);
  settingsDialog?.addEventListener('toggle', refreshSoon);
  settingsDialog?.addEventListener('click', () => setTimeout(refreshSoon, 0), {capture:true});
  cameraSelect.addEventListener('focus', refreshSoon);
  microphoneSelect.addEventListener('focus', refreshSoon);
  speakerSelect?.addEventListener('focus', refreshSoon);
  qualitySelect?.addEventListener('change', () => applyVideoQuality().catch(() => {}), {capture:true});

  const streamObserver = new MutationObserver(refreshSoon);
  [$('prejoinVideo'), $('selfVideo'), $('stageVideo')].filter(Boolean).forEach(node => streamObserver.observe(node, {attributes:true,attributeFilter:['src']}));

  document.addEventListener('loadedmetadata', event => {
    if (event.target instanceof HTMLVideoElement) refreshSoon();
  }, true);

  addStatus();
  refreshSoon();

  if (!document.querySelector('script[data-ds-dock-polish-2030]')) {
    const dockPolish = document.createElement('script');
    dockPolish.src = '/assets/js/meet/dock-polish-2030.js?v=1-operation-2030';
    dockPolish.dataset.dsDockPolish2030 = '1';
    document.head.append(dockPolish);
  }

  if (!document.querySelector('script[data-ds-remote-share-watchdog]')) {
    const shareWatchdog = document.createElement('script');
    shareWatchdog.src = '/assets/js/meet/remote-share-watchdog.js?v=1-operation-2030';
    shareWatchdog.dataset.dsRemoteShareWatchdog = '1';
    document.head.append(shareWatchdog);
  }

  if (!document.querySelector('script[data-ds-background-effects-2030]')) {
    const backgroundEffects = document.createElement('script');
    backgroundEffects.src = '/assets/js/meet/background-effects-2030.js?v=1-operation-2030';
    backgroundEffects.dataset.dsBackgroundEffects2030 = '1';
    document.head.append(backgroundEffects);
  }

  if (!document.querySelector('script[data-ds-share-ui-2030]')) {
    const shareUi = document.createElement('script');
    shareUi.src = '/assets/js/meet/share-ui-2030.js?v=1-operation-2030';
    shareUi.dataset.dsShareUi2030 = '1';
    document.head.append(shareUi);
  }

  window.DominionCameraReactionPolish = Object.freeze({
    version:'1.5.0',
    refreshDeviceNames,
    applyVideoQuality,
    hardwareVideoTrack,
    snapshot:() => ({
      cameras:[...cameraSelect.options].map(option => ({id:option.value,label:option.textContent,resolved:option.dataset.deviceLabelResolved === '1'})),
      microphones:[...microphoneSelect.options].map(option => ({id:option.value,label:option.textContent,resolved:option.dataset.deviceLabelResolved === '1'})),
      reactionLayer:Boolean(reactionLayer),
      backgroundProcessor:Boolean(window.DominionBackgroundEffects2030),
      backgroundActive:Boolean(window.DominionBackgroundEffects2030?.isActive?.()),
      sourceVideoState:hardwareVideoTrack()?.readyState || 'none',
      shareUi:Boolean(window.DominionShareUI2030)
    })
  });
})();