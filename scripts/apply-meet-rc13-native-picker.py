#!/usr/bin/env python3
"""Align exact production screen sharing with Electron's macOS system picker.

Electron documents that when `useSystemPicker` is enabled and available, the
setDisplayMediaRequestHandler callback is not invoked. Therefore DominionStar
must not run its custom source picker first on those Macs; doing both creates a
double-picker / stale-selection path. Older macOS and Windows keep the audited
custom picker path.
"""

import hashlib
import json
from pathlib import Path

ENGINE=Path('assets/js/meeting-engine.js')
CONTRACT=Path('meet/release-contract.json')

source=ENGINE.read_text(encoding='utf-8')
old="""    let desktopSelection=null;
    const desktopExpected=/(?:^|[?&])desktop=1(?:&|$)/.test(String(globalThis.location?.search||''));
    if(desktopExpected&&(!window.dominionDesktop?.isDesktop||!window.DominionDesktopSharePicker?.choose)){
      throw new Error('The DominionStar desktop capture bridge did not load. Install the latest desktop update and completely reopen the app.');
    }
    if(window.dominionDesktop?.isDesktop && window.DominionDesktopSharePicker?.choose){
      desktopSelection=await window.DominionDesktopSharePicker.choose();
      if(!desktopSelection){const cancelled=new Error('Screen sharing cancelled.');cancelled.name='AbortError';throw cancelled;}
      const accepted=await window.dominionDesktop.selectShareSource(desktopSelection.sourceId,desktopSelection.audio,desktopSelection.displayId||'',desktopSelection.kind||'',desktopSelection.sourceName||'',desktopSelection.shareOwnWindow);
      if(!accepted)throw new Error('The selected screen is no longer available. Open Share and select it again.');
    }
    // Keep the browser request standards-safe. Several Chromium/macOS versions
    // report experimental display-capture hints as NotAllowedError instead of
    // TypeError, which previously made a valid user selection look like an OS
    // permission denial. The native picker still provides screen/window/tab
    // selection and the optional audio choice.
    const desktopAudio=Boolean(desktopSelection?.audio&&window.dominionDesktop?.supportsSystemAudioShare);
    const displayOptions=desktopSelection
      ? {video:true,...(desktopAudio?{audio:true}:{})}
      : {video:true,audio:true};
"""
new="""    let desktopSelection=null;
    const desktopExpected=/(?:^|[?&])desktop=1(?:&|$)/.test(String(globalThis.location?.search||''));
    const desktopRuntime=window.dominionDesktop?.isDesktop
      ? await window.dominionDesktop.getRuntimeInfo?.().catch(()=>null)
      : null;
    const useNativeSystemPicker=Boolean(desktopRuntime?.systemSharePicker);
    if(desktopExpected&&(!window.dominionDesktop?.isDesktop||(!useNativeSystemPicker&&!window.DominionDesktopSharePicker?.choose))){
      throw new Error('The DominionStar desktop capture bridge did not load. Install the latest desktop update and completely reopen the app.');
    }
    // Electron 32+ on macOS 15+ can hand getDisplayMedia directly to Apple's
    // native picker. When that path is active Electron does not invoke the
    // custom display-media handler, so do not preselect a second source here.
    if(window.dominionDesktop?.isDesktop && !useNativeSystemPicker && window.DominionDesktopSharePicker?.choose){
      desktopSelection=await window.DominionDesktopSharePicker.choose();
      if(!desktopSelection){const cancelled=new Error('Screen sharing cancelled.');cancelled.name='AbortError';throw cancelled;}
      const accepted=await window.dominionDesktop.selectShareSource(desktopSelection.sourceId,desktopSelection.audio,desktopSelection.displayId||'',desktopSelection.kind||'',desktopSelection.sourceName||'',desktopSelection.shareOwnWindow);
      if(!accepted)throw new Error('The selected screen is no longer available. Open Share and select it again.');
    }
    // Browser clients and the native macOS system picker request standards-safe
    // display media directly. Older desktop runtimes retain the custom source
    // transaction and optional verified system-audio choice.
    const desktopAudio=Boolean(desktopSelection?.audio&&window.dominionDesktop?.supportsSystemAudioShare);
    const displayOptions=desktopSelection
      ? {video:true,...(desktopAudio?{audio:true}:{})}
      : {video:true,audio:true};
"""
count=source.count(old)
if count!=1:
    raise SystemExit(f'native picker alignment: expected exactly one production share block, found {count}')
source=source.replace(old,new,1)
ENGINE.write_text(source,encoding='utf-8')

contract=json.loads(CONTRACT.read_text(encoding='utf-8'))
if contract.get('releaseId')!='2026.08.16-rc13.0-media-share-link-stability':
    raise SystemExit(f"Unexpected releaseId before native picker alignment: {contract.get('releaseId')}")
contract['files']['assets/js/meeting-engine.js']=hashlib.sha256(ENGINE.read_bytes()).hexdigest()
CONTRACT.write_text(json.dumps(contract,indent=2)+'\n',encoding='utf-8')
print('Native system-picker alignment applied')
print(contract['files']['assets/js/meeting-engine.js'])
