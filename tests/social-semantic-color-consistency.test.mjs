import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('assets/css/dominionstar-cinematic-os.css');
const notifications=read('assets/js/notifications-center.js');
const community=read('assets/js/community-hub.js');

test('Messages use communication blue and safety colors instead of premium gold',()=>{
  assert.match(css,/\.dm-message\.outgoing \.dm-message-bubble\{[\s\S]*#1877f2[\s\S]*#0d63d9/);
  assert.match(css,/#dmSendButton\{[\s\S]*#2583f7[\s\S]*#126be2/);
  assert.match(css,/\.dm-conversation\.active\{[\s\S]*rgba\(24,119,242,.18\)/);
  assert.match(css,/\.dm-conversation-meta b\{[\s\S]*var\(--dsx-danger\)/);
  assert.match(css,/#dmIncomingCall \.accept,[\s\S]*var\(--dsx-success\)/);
  assert.match(css,/#dmEndCall,[\s\S]*var\(--dsx-danger\)/);
});

test('Notification categories expose meaningful semantic states',()=>{
  assert.match(notifications,/notification-\$\{category\(e\)\}/);
  assert.match(notifications,/notification-missed/);
  assert.match(notifications,/notification-item-icon/);
  assert.match(css,/#notificationFilters button\.active\{[\s\S]*#2583f7/);
  assert.match(css,/\.notification-item\.unread\{[\s\S]*var\(--dsx-danger\)/);
  assert.match(css,/\.notification-communications \.notification-item-icon\{[\s\S]*rgba\(24,119,242,.11\)/);
  assert.match(css,/\.notification-missed \.notification-item-icon\{[\s\S]*rgba\(255,77,90,.12\)/);
  assert.match(css,/\.notification-meetings \.notification-item-icon\{[\s\S]*rgba\(242,201,76,.11\)/);
  assert.match(css,/\.notification-journey \.notification-item-icon\{[\s\S]*rgba\(53,208,127,.11\)/);
  assert.match(css,/\.notification-recognition \.notification-item-icon\{[\s\S]*rgba\(240,193,91,.11\)/);
});

test('Community reactions and post types use semantic social colors and real active state',()=>{
  assert.doesNotThrow(()=>new vm.Script(community));
  assert.match(community,/const active=reactions\.some\(item=>item\.user_id===session\.user\.id&&item\.reaction===reaction\)/);
  assert.ok(community.includes("community-reaction-button '+(active?'is-active':'')+'"));
  assert.match(community,/aria-pressed=/);
  assert.match(css,/\.community-post-type\.discussion\{[\s\S]*rgba\(24,119,242,.11\)/);
  assert.match(css,/\.community-post-type\.question\{[\s\S]*rgba\(242,201,76,.10\)/);
  assert.match(css,/\.community-post-type\.milestone\{[\s\S]*rgba\(53,208,127,.10\)/);
  assert.match(css,/\.community-post-type\.announcement\{[\s\S]*rgba\(240,193,91,.11\)/);
  assert.match(css,/data-reaction="like"\]\:hover,[\s\S]*rgba\(24,119,242,.12\)/);
  assert.match(css,/data-reaction="support"\]\:hover,[\s\S]*rgba\(53,208,127,.10\)/);
  assert.match(css,/data-reaction="insightful"\]\:hover,[\s\S]*rgba\(155,140,255,.10\)/);
});

test('Gold remains reserved for premium and official states',()=>{
  assert.match(css,/\.community-pinned-label\{[\s\S]*#f3cb6d[\s\S]*#d79b32/);
  assert.match(css,/\.community-post-type\.announcement/);
  const at=css.lastIndexOf('.dm-message.outgoing .dm-message-bubble{');
  assert.ok(at>=0);
  const effective=css.slice(at,at+420);
  assert.match(effective,/#1877f2/);
  assert.doesNotMatch(effective,/240,193,91/);
});
