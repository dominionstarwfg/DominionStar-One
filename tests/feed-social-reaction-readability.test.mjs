import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const social=read('assets/js/dashboard-social.js');
const css=read('assets/css/dominionstar-cinematic-os.css');

test('Feed supports five semantic reactions through the existing reaction RPC',()=>{
  assert.doesNotThrow(()=>new vm.Script(social));
  assert.match(social,/reactionOrder=\['like','love','celebrate','support','insightful'\]/);
  assert.match(social,/community_toggle_reaction/);
  assert.match(social,/target_reaction:reaction/);
  assert.match(social,/data-reaction="'\+name\+'"/);
  assert.match(social,/viewerReaction/);
  assert.match(social,/totalReactions/);
  assert.match(social,/ds30-reaction-summary/);
});

test('Feed reactions have Facebook-like semantic color separation',()=>{
  assert.match(css,/\.ds30-react-main\.reaction-like\{color:#66a7ff/);
  assert.match(css,/\.ds30-react-main\.reaction-love\{color:#ff7180/);
  assert.match(css,/\.ds30-react-main\.reaction-celebrate\{color:#f5ce71/);
  assert.match(css,/\.ds30-react-main\.reaction-support\{color:#74e6aa/);
  assert.match(css,/\.ds30-react-main\.reaction-insightful\{color:#b9afff/);
  assert.match(css,/\.ds30-reaction-love\{background:linear-gradient\(135deg,#ff6a78,#e82f4b\)/);
  assert.match(css,/\.ds30-reaction-like\{background:linear-gradient\(135deg,#3188f7,#126be2\)/);
});

test('Feed post surfaces preserve readable hierarchy on the dark executive background',()=>{
  assert.match(css,/body\.ds-auth-os-page \.ds30-social-post,[\s\S]*rgba\(21,48,84,.985\)/);
  assert.match(css,/body\.ds-auth-os-page \.ds30-post-copy,[\s\S]*color:#e6edf7/);
  assert.match(css,/body\.ds-auth-os-page \.ds30-post-engagement,[\s\S]*border-top:1px solid rgba\(126,168,221,.10\)/);
  assert.match(css,/body\.ds-auth-os-page \.dsx-feed-page-composer textarea\{[\s\S]*background:rgba\(5,22,44,.78\)/);
});


test('reaction badges are device-independent SVG colors rather than system emoji',()=>{
  assert.match(social,/reactionBadge = name =>/);
  assert.match(css,/\.ds30-reaction-like\{background:#1877f2!important;color:#fff!important\}/);
  assert.match(css,/\.ds30-reaction-love\{background:#ff3b55!important;color:#fff!important\}/);
  assert.match(css,/\.ds30-reaction-celebrate\{background:#e8aa28!important;color:#fff!important\}/);
  assert.doesNotMatch(social,/emoji:'👍'|emoji:'❤️'/);
});
