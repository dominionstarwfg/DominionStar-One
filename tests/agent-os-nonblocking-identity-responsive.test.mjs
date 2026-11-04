import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const messages=read('assets/js/direct-messages.js');
const directory=read('assets/js/member-directory.js');
const nav=read('assets/js/dominionstar-agent-nav-shell.js');
const css=read('assets/css/dominionstar-cinematic-os.css');
const preview=read('scripts/build-public-netlify.sh');

test('agent inbox renders before optional avatar or presence service calls',()=>{
  assert.doesNotThrow(()=>new vm.Script(messages));
  assert.ok(!messages.includes('await Promise.all(members.map(member => resolveAvatar(member)))'));
  const memberFetch=messages.indexOf("members = (membersResult.data || []).map(");
  const summaries=messages.lastIndexOf("await loadConversationSummaries();\n  renderMembers('');");
  const hydration=messages.indexOf('Promise.allSettled(batch.map(resolveAvatar))');
  const incoming=messages.indexOf('await subscribeIncomingCallInbox()');
  assert.ok(memberFetch>=0&&summaries>memberFetch&&hydration>summaries&&incoming>hydration);
  assert.ok(messages.includes('Avatar request timeout'));
  assert.ok(messages.includes('window.DominionStarPresence.init()'));
  assert.ok(messages.includes('Presence is optional, and cannot block messaging'));
  assert.ok(messages.includes('setAvatarElement(memberAvatarLarge,current)'));
});

test('member directory draws approved names and initials without awaiting signed photos',()=>{
  assert.doesNotThrow(()=>new vm.Script(directory));
  assert.ok(!directory.includes('const cards=await Promise.all(filtered.map'));
  assert.match(directory,/const cards=filtered\.map\(m=>/);
  assert.match(directory,/grid\.innerHTML=cards\.length\?cards\.join/);
  assert.match(directory,/renderVersion/);
  assert.match(directory,/if\(!url\|\|version!==renderVersion\)return/);
  assert.match(directory,/avatarRequests\.has\(path\)/);
  assert.match(directory,/expiresAt:Date\.now\(\)\+55\*60\*1000/);
  assert.match(directory,/class="member-directory-photo"/);
  assert.match(directory,/id="directoryRetry"/);
});

test('compact navigation reserves its measured height for the Messages viewport',()=>{
  assert.match(nav,/--ds-agent-shell-compact-height/);
  assert.match(nav,/shell\.getBoundingClientRect\(\)\.height/);
  assert.match(css,/height:calc\(100dvh - var\(--ds-agent-shell-compact-height, 122px\)\)!important/);
  assert.match(css,/body\.ds-auth-os-page\.dm-os-body \.dm-os\.dm-os-three\{[\s\S]*display:block!important/);
  assert.match(css,/body\.ds-auth-os-page\.dm-os-body \.dm-os\.conversation-open \.dm-chat\{transform:none!important/);
  assert.match(preview,/body\.ds-visual-review #dmApp\.dm-os\.dm-os-three\{display:block!important/);
  assert.match(preview,/body\.ds-visual-review #dmApp \.dm-chat\{transform:none!important/);
});

test('no production behavior was traded for invented preview identity data',()=>{
  assert.match(directory,/\.eq\('verification_status','approved'\)/);
  assert.match(messages,/\.eq\('verification_status','approved'\)/);
  assert.match(messages,/member-avatars/);
  assert.match(directory,/member-avatars/);
  assert.match(preview,/VISUAL REVIEW ONLY/);
});
