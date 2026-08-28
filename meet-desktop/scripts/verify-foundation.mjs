import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const main=read('src/main.mjs');
const preload=read('src/preload.cjs');
const html=read('ui/index.html');
const css=read('ui/styles.css');
const js=read('ui/app.js');
const preferences=read('ui/preferences.js');
const personal=read('ui/personal-room.js');
const personalCss=read('ui/personal-room.css');
const schedule=read('ui/schedule-controller.js');
const scheduleCss=read('ui/schedule.css');
const shareService=read('src/share-service.mjs');
const shareCss=read('ui/share.css');
const presenterHtml=read('ui/presenter-toolbar.html');
const presenterCss=read('ui/presenter-toolbar.css');
const presenterJs=read('ui/presenter-toolbar.js');
const packageJson=JSON.parse(read('package.json'));
const appIcon=read('build/icon.svg');

assert(main.includes("const uiDir=path.join(__dirname,'..','ui')"),'Desktop must define one local UI directory authority.');
assert(main.includes("mainWindow.loadFile(path.join(uiDir,'index.html'))"),'Desktop must load Home from the local UI directory.');
assert(!main.includes('dominionstarld.com'),'Desktop shell must not depend on the public website.');
assert(main.includes("if(url.startsWith('file://'))return"),'Navigation must remain local by default.');
assert(preload.includes('contextIsolation')===false,'Preload should expose only the explicit bridge, not runtime configuration.');
for(const label of ['New Meeting','Join','Schedule','Share Screen'])assert(html.includes(`>${label}<`),`Missing Home action: ${label}`);
for(const section of ['homeSection','meetingsSection'])assert(html.includes(`id=\"${section}\"`),`Missing desktop section ${section}`);
assert(!html.includes('id="contactsSection"')&&!html.includes('data-section="contacts"'),'Dead Contacts placeholder must not ship.');
assert(!html.includes('aria-label="Search"'),'Dead Search control must not ship.');
assert(!html.includes('will live here')&&!html.includes('wired after'),'Developer placeholder copy must not ship.');
for(const script of ['./preferences.js','./personal-room.js','./schedule-controller.js'])assert(html.includes(`<script src=\"${script}\"></script>`),`Desktop must load ${script}.`);
for(const style of ['./personal-room.css','./schedule.css'])assert(html.includes(`<link rel=\"stylesheet\" href=\"${style}\">`),`Desktop must load ${style}.`);
assert(html.includes('id="scheduleForm"')&&html.includes('id="scheduledMeetingList"'),'Schedule and Meetings must have real UI surfaces.');
assert(!html.includes('meet_personal_rooms'),'Undeployed legacy backend table name must never leak into the Home UI.');
assert(css.includes('.action-card:active{transform:translateY(0) scale(.99)}'),'Action controls must visibly release after click.');
assert(js.includes("document.body.dataset.shareAfterJoin='1';openDialog('join')"),'Home Share must enter the real meeting/share flow.');
assert(!js.includes("notice('Share remains isolated'"),'Home Share must not return to the old placeholder notice.');
assert(!js.includes('getDisplayMedia'),'Home/room controller must not own screen capture.');
assert(js.includes("greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'"),'Home greeting must be time-aware.');

assert(personal.includes('Use Personal Meeting ID'),'New Meeting must expose the Personal Meeting ID choice.');
assert(personal.includes('useForInstant'),'Personal Meeting ID instant-meeting preference must be respected.');
assert(personal.includes('meeting.startPersonalRoom()'),'Personal Room Start must reopen the persistent Personal Room identity.');
assert(personal.includes('meeting.updatePersonalRoom'),'Personal Room settings must persist through the meeting authority.');
assert(personal.includes('pattern="[0-9]{3,7}"')&&personal.includes('maxlength="7"'),'Personal Room passcode UI must accept 3–7 digits only.');
assert(personal.includes('Changing the passcode does not change the Personal Meeting ID.'),'Personal Room editor must communicate stable Meeting ID behavior.');
assert(personalCss.includes('.personal-room-card')&&personalCss.includes('.personal-room-modal'),'Personal Room must have a real Meetings card and editor layout.');

assert(schedule.includes('Generate Automatically')&&schedule.includes('Personal Meeting ID'),'Schedule must offer generated identity or Personal Meeting ID.');
for(const repeat of ['Daily','Weekly','Monthly','Every weekday','Custom'])assert(schedule.includes(`>${repeat}<`),`Schedule recurrence option missing ${repeat}.`);
assert(schedule.includes('await meeting.schedule('),'Schedule must create a persistent scheduled identity through the meeting authority.');
assert(!schedule.includes('await meeting.create({title,passcode'),'Schedule must not create a fresh live room as its scheduling mechanism.');
assert(schedule.includes('await meeting.startSchedule(item.scheduleId)'),'Starting a scheduled/recurring meeting must reopen the existing meeting identity.');
assert(schedule.includes("mode==='personal'&&recurrence"),'Fixed recurrence must not silently reuse the Personal Meeting ID.');
assert(schedule.includes("/^\\d{3,7}$/"),'Generated scheduled meeting passcodes must be validated as 3–7 digits.');
assert(scheduleCss.includes('.scheduled-row')&&scheduleCss.includes('.scheduled-home-list')&&scheduleCss.includes('.schedule-option-grid'),'Scheduled and recurring meetings must render on Home, Meetings, and Schedule surfaces.');

for(const key of ['joinMuted','joinVideoOff','shareVideoDock','shareOptimize','shareAudio','chatSound','recordMic','recordRemote','uiScale','shortcuts'])assert(preferences.includes(`${key}:`),`Preferences missing ${key}.`);
for(const section of ['Meetings','Share Screen','Chat','Recording','Accessibility','Keyboard Shortcuts','About'])assert(preferences.includes(`'${section}'`),`Preferences section missing: ${section}`);
assert(!preferences.includes('will be added'),'Preferences must not expose dead future-feature copy.');

assert(shareService.includes('compactMainWindow'),'Desktop sharing must own a native compact meeting-window mode.');
assert(shareService.includes("main.on('minimize',mainMinimizeHandler)"),'Minimizing during a share must compact the meeting window instead of losing participant video.');
assert(shareService.includes("main.setAlwaysOnTop(true,'floating')"),'Compact participant video must remain above the presented content.');
assert(shareService.includes('main.setMinimumSize(300,190)'),'Share mode must temporarily release the normal full meeting minimum size.');
assert(shareService.includes('restoreMainWindowAfterShare'),'Stopping a share must restore the original meeting window geometry.');
assert(shareService.includes('setContentProtection'),'Presenter meeting chrome must request capture exclusion through Electron.');
assert(shareService.includes("meetingVisible:false")&&shareService.includes("meetingVisible:true"),'Presenter controls must track compact versus full meeting visibility.');
assert(shareCss.includes('@media(max-width:560px) and (max-height:360px)'),'Share UI must have a dedicated compact participant-panel layout.');
assert(shareCss.includes('.participant-video-dock.count-1'),'Compact video panel must adapt to the participant count.');
assert(presenterHtml.includes('<svg viewBox="0 0 24 24"'),'Presenter toolbar must use vector controls.');
for(const legacyGlyph of ['◉','▣','♙','▢','Ⅱ','✎','▤'])assert(!presenterHtml.includes(legacyGlyph),`Presenter toolbar must not regress to legacy glyph ${legacyGlyph}.`);
assert(presenterCss.includes('.icon svg'),'Presenter toolbar must explicitly style its vector icon system.');
assert(presenterJs.includes("state?.meetingVisible?'Hide meeting':'Show meeting'"),'Presenter toolbar must expose the real meeting-window visibility state.');

assert(packageJson.build?.appId==='com.dominionstar.desktop','Desktop rebuild must preserve the DominionStar macOS/Windows application identity.');
assert(packageJson.build?.productName==='DominionStar Meet','Desktop rebuild must preserve the DominionStar Meet product name.');
assert(packageJson.build?.mac?.icon==='build/icon.svg','macOS package must use the DominionStar Meet app icon.');
assert(packageJson.build?.win?.icon==='build/icon.svg','Windows package must use the DominionStar Meet app icon.');
assert(appIcon.includes('<title id="title">DominionStar Meet</title>'),'Branded desktop icon must identify DominionStar Meet.');
assert(appIcon.includes('geometric D monogram')&&appIcon.includes('url(#gold)')&&appIcon.includes('url(#orbit)'),'Desktop icon must retain the approved DominionStar D/star/orbit artwork.');

console.log('DOMINIONSTAR_DESKTOP_FOUNDATION_OK local-home four-primary-actions personal-room stable-identity passcode-3-7 recurring-schedules live-preferences no-dead-home-chrome responsive-controls real-share-entry isolated-share-module native-compact-share-window vector-presenter-controls branded-app-identity');
