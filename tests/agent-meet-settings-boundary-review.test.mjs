import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const agentHtml=read('account-settings/index.html');
const agentJs=read('assets/js/account-settings.js');
const dashboard=read('member-dashboard/index.html');
const agentNav=read('assets/js/dominionstar-agent-nav-shell.js');
const agentOs=read('assets/js/dominionstar-os.js');
const meetHtml=read('meet-desktop/ui/index.html');
const meetPrefs=read('meet-desktop/ui/preferences.js');
const meetAv=read('meet-desktop/ui/av-settings.js');

test('Agent Settings is dedicated to the agent account and has no Meet controls',()=>{
  assert.match(agentHtml,/<title>Agent Settings \| DominionStar Executive OS<\/title>/);
  assert.match(agentHtml,/<h1>Agent Settings<\/h1>/);
  for(const tab of ['system','messages','notifications','privacy-security','sessions']){
    assert.match(agentHtml,new RegExp('data-settings-tab="'+tab+'"'));
    assert.match(agentHtml,new RegExp('data-settings-panel="'+tab+'"'));
  }
  for(const tab of ['audio-video','meeting-defaults']){
    assert.doesNotMatch(agentHtml,new RegExp('data-settings-tab="'+tab+'"'));
    assert.doesNotMatch(agentHtml,new RegExp('data-settings-panel="'+tab+'"'));
  }
  for(const id of ['mediaSwitches','meetingSwitches','meetingResult','mediaResult']){
    assert.doesNotMatch(agentHtml,new RegExp('id="'+id+'"'));
  }
  assert.doesNotMatch(agentHtml,/href="\/meet-home\/"/);
});

test('Agent Settings JS no longer owns Meet media defaults or writes Meet local preferences',()=>{
  assert.doesNotMatch(agentJs,/meetingMedia|joinMuted|joinCameraOff|mediaSwitches|meetingSwitches/);
  assert.doesNotMatch(agentJs,/ds_meet_preferences/);
  for(const preserved of ['dominionstar_settings','appearance','privacy','notification_preferences','passwordForm','signOutOtherSessions']){
    assert.match(agentJs,new RegExp(preserved));
  }
  assert.match(agentHtml,/id="googleIdentitySettings"/);
  assert.match(agentHtml,/data-settings-panel="privacy-security"/);
});

test('Dashboard and shared nav call the account area Agent Settings',()=>{
  assert.match(dashboard,/href="\/account-settings\/".*?<span>Agent Settings<\/span>/);
  assert.match(agentNav,/\['Agent Settings','\/account-settings\/','settings'\]/);
  assert.match(agentOs,/\['Agent Settings','\/account-settings\/'/);
  assert.doesNotMatch(agentNav,/EXECUTIVE OS 2030/);
});

test('Meet retains its own fully functional settings categories',()=>{
  assert.match(meetHtml,/id="settingsDialog"/);
  assert.match(meetHtml,/<h2>(?:Meet )?Settings<\/h2>/);
  for(const category of ['Audio','Video','Meetings','Sharing']){
    assert.match(meetHtml,new RegExp(category));
  }
  for(const category of ['openMeetings','openSharing','openChat','openRecording','openAccessibility','openShortcuts'])
    assert.match(meetPrefs,new RegExp(category));
  assert.match(meetAv,/openAudioSettings/);
  assert.match(meetAv,/openVideoSettings/);
  assert.match(meetPrefs,/ds_pref_join_muted/);
  assert.match(meetPrefs,/ds_pref_join_video_off/);
  assert.match(meetHtml,/DominionStar Meet preferences (?:only|are stored locally)/);
  assert.match(meetHtml,/\.\/preferences\.js/);
  assert.match(meetHtml,/\.\/av-settings\.js/);
});

test('Aurora routes Meet questions to Meet, not Agent Settings',()=>{
  assert.match(agentOs,/terms:\['meet settings','meeting settings'/);
  assert.match(agentOs,/url:'\/meet\/'/);
  assert.match(agentOs,/Opening Agent Settings/);
});
