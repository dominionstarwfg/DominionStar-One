import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const auth=read('ui/auth-password.js');
const refJs=read('ui/zoom-screenshot-reference-2.0.41.js');
const refCss=read('ui/zoom-screenshot-reference-2.0.41.css');
const pickerHtml=read('ui/share-picker.html');
const pickerCss=read('ui/share-picker.css');
const pickerJs=read('ui/share-picker.js');
const shareService=read('src/share-service.mjs');
const shareController=read('ui/share-controller.js');

const has=(s,n,m)=>assert.ok(s.includes(n),m);
const lacks=(s,n,m)=>assert.ok(!s.includes(n),m);

assert.equal(pkg.version,'2.0.41','Zoom screenshot reference lock must run only on 2.0.41.');
has(auth,"zoom-screenshot-reference-2.0.41.css",'Screenshot reference CSS is not loaded.');
has(auth,"zoom-screenshot-reference-2.0.41.js",'Screenshot reference JS is not loaded.');
has(auth,'script.onload=loadScreenshotReference','Screenshot reference must load after runtime stability completes.');
has(auth,'if(window.DominionRuntimeStability)loadScreenshotReference()','Existing runtime stability must hand off to the screenshot reference authority.');

// Home screenshot contract.
has(refCss,'grid-template-columns:82px minmax(0,1fr)','Home must use the narrow Zoom-style app rail.');
has(refCss,'grid-template-columns:minmax(520px,1fr) 330px','Home must use action area + right calendar panel.');
has(refCss,'#homeSection .action-icon','Home must use icon-first meeting actions rather than dashboard cards.');
has(refJs,'My Notes','Home must include a working local My Notes action.');
has(refJs,'ds-ref-search','Home must include the compact top search surface.');

// Prejoin screenshot contract.
has(refCss,'width:548px!important','Prejoin must remain a compact Zoom-scale dialog.');
has(refJs,'Always show this preview when joining','Prejoin preference row is missing.');
has(refJs,"strong.textContent='Backgrounds'",'Prejoin Backgrounds label is not normalized.');

// Meeting toolbar contract.
for(const label of ['Audio','Video','Participants','Chat','React','Raise hand','Share','Host tools','More','End'])has(refJs,`'${label}'`,`Meeting toolbar is missing ${label}.`);
has(refCss,'height:56px!important','Meeting bottom toolbar must keep the compact Zoom-scale height.');
has(refCss,'grid-template-columns:minmax(142px,1fr) auto minmax(142px,1fr)','Meeting toolbar must preserve left/center/right zoning.');

// Participants / participant-wide controls are separate from Host tools.
has(refJs,'ds-ref-participants-footer','Participants footer is missing.');
has(refJs,'Ask all to unmute','Participants More popover is missing Ask all to unmute.');
has(refJs,'Mute all upon entry','Participants More popover is missing mute-on-entry.');
has(refJs,'Play join and leave sound','Participants More popover is missing join/leave sound.');
has(refJs,'Host tools for participants','Participants More popover is missing Host tools for participants.');
has(refJs,'data-clear disabled','Unimplemented participant feedback clearing must remain physically disabled.');
has(refCss,'#participantRoster .ds-participant-media{display:none!important','Rejected duplicate participant media renderer must stay hidden.');

// Host tools is its own right-side sheet. Dynamic waiting-room switching is not
// in the deployed meet_v2_set_security RPC, so the reference position must stay
// physically disabled rather than pretending to change live room authority.
has(refJs,'ds-ref-host-tools-panel','Host tools right panel is missing.');
has(refJs,'Lock meeting','Host tools is missing Lock meeting.');
has(refJs,'Enable waiting room','Host tools is missing waiting-room position.');
has(refJs,'data-waiting disabled','Waiting-room control must stay physically disabled until the live room-security RPC supports switching.');
has(refJs,'Dynamic waiting-room switching is not exposed by the current room-security RPC','Waiting-room disabled state must explain its authority limitation.');
has(refJs,'Hide profile pictures','Host tools is missing Hide profile pictures.');
has(refJs,'data-participants','Host tools is missing Participants navigation.');
has(refJs,'data-advanced','Host tools is missing Advanced navigation.');

// More is its own tool grid. Visual-only capabilities must remain true disabled
// buttons; only implemented actions may be interactive.
has(refJs,'ds-ref-meeting-more-grid','Meeting More grid is missing.');
for(const label of ['Record','Show captions','Breakout rooms','Polls/quizzes','Docs','Whiteboards','Apps','Meeting info','Transfer to room','Settings'])has(refJs,`'${label}'`,`Meeting More is missing ${label}.`);
for(const label of ['Breakout rooms','Polls/quizzes','Docs','Whiteboards','Apps','Transfer to room']){
  const marker=`addMoreItem(grid,'${label}'`;
  const start=refJs.indexOf(marker);
  assert.ok(start>=0,`Meeting More is missing ${label}.`);
  const segment=refJs.slice(start,start+420);
  has(segment,'{disabled:true}',`${label} must remain physically disabled until its backend/product capability is certified.`);
}
has(refJs,'Drag to pin or remove from toolbar','Meeting More footer reference is missing.');

// Pre-share screenshot contract. Files keeps the visual reference position but
// must not be pointer- or keyboard-activatable before local-file presenting is
// actually implemented.
has(pickerHtml,'data-tab="screens">Screens','Pre-share must expose Screens.');
has(pickerHtml,'data-tab="files" aria-disabled="true" disabled tabindex="-1"','Pre-share Files reference position must be physically non-interactive.');
has(pickerHtml,'data-tab="advanced">More','Pre-share must expose More.');
has(pickerCss,'.tab[aria-disabled="true"]{opacity:.92;cursor:default;pointer-events:none}','Aria-disabled pre-share capabilities must reject pointer activation.');
has(pickerHtml,'Presenter layout','Pre-share right rail is missing Presenter layout.');
for(const label of ['Content only','As background','Over the shoulder','Side by side','Share sound','Optimize for video sharing','Share DominionStar Meet windows'])has(pickerHtml,label,`Pre-share is missing ${label}.`);
has(pickerJs,"sectionMarkup('Entire screen'",'Pre-share must group the entire desktop first.');
has(pickerJs,"sectionMarkup('Application windows'",'Pre-share must group application windows separately.');
has(pickerJs,"kind:'screen'",'Pre-share is not enumerating real screens.');
has(pickerJs,"kind:'window'",'Pre-share is not enumerating real application windows.');
has(pickerJs,'source.thumbnail','Pre-share must render real source previews.');
has(pickerCss,'.source-section.screen-section','Pre-share screen group styling is missing.');
has(pickerCss,'.presenter-layout','Pre-share presenter rail styling is missing.');
has(pickerCss,'.loading-state[hidden],.error-state[hidden]{display:none!important}','Hidden pre-share state overlays must remain physically non-rendering.');
lacks(pickerHtml,'Share This Window','Apple system overlay language must never be part of the DominionStar picker.');

// Capture ownership and bounded start remain hard requirements.
has(shareService,'const nativeSystemPicker=false','Apple system picker must remain disabled in the active DominionStar share path.');
has(shareController,"error.code='share_start_timeout'",'Share start must fail visibly when capture does not start.');
has(shareController,'},5000);','Share start must remain bounded to five seconds.');

// Active-share screenshot contract: toolbar is revealed by pointer motion and
// automatically hides again when the pointer is idle.
has(refJs,"overlay.classList.add('ds-ref-presenter-visible')",'Presenter toolbar reveal authority is missing.');
has(refJs,"overlay.classList.remove('ds-ref-presenter-visible'),1650",'Presenter toolbar idle auto-hide is missing.');
has(refJs,"'Layout'",'Presenter toolbar is missing Layout.');
has(refJs,"'Show meeting'",'Presenter toolbar is missing Show meeting.');
has(refJs,'Stop share','Presenter green strip is missing Stop share.');
has(refCss,'opacity:0!important;pointer-events:none!important','Presenter toolbar must be hidden while idle.');
has(refCss,'.ds-ref-presenter-visible #inlinePresenterToolbar','Presenter toolbar must become interactive only when revealed.');

// Privacy rule: the reference implementation must contain no user screenshot or
// personal-photo asset reference.
for(const source of [refJs,refCss,pickerHtml,pickerJs,pickerCss]){
  lacks(source,'Screenshot 2026-09-03','User screenshots must never be embedded in app source.');
  lacks(source,'private-user-images.githubusercontent.com','User image uploads must never be linked into the product.');
}

console.log('DOMINIONSTAR_ZOOM_SCREENSHOT_REFERENCE_2_0_41_OK home prejoin meeting-toolbar participants participant-more host-tools meeting-more truthful-disabled-capabilities zoom-preshare bounded-share mouse-reveal-presenter privacy');
