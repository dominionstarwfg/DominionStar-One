import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('scripts/security/community-single-reaction.DO-NOT-RUN.review.sql');
const archive=read('scripts/security/community-reaction-archive.DO-NOT-RUN.review.sql');
const social=read('assets/js/dashboard-social.js');
const hub=read('assets/js/community-hub.js');
const css=read('assets/css/dominionstar-community-reactions.css');
const html=read('community/index.html');
const browser=read('scripts/review-feed-social-interactions.mjs');

test('All five semantic reactions are supported by both frontends and the database proposal',()=>{
  assert.doesNotThrow(()=>new vm.Script(social));
  assert.doesNotThrow(()=>new vm.Script(hub));
  for(const type of ['like','love','celebrate','support','insightful']){
    assert.match(sql,new RegExp("'"+type+"'"));
    assert.match(hub,new RegExp(type==='love'?"love:'<path":"[,' ]"+type));
  }
  assert.match(social,/reactionOrder=\['like','love','celebrate','support','insightful'\]/);
  assert.match(hub,/\['like','love','celebrate','support','insightful'\]\.map/);
  assert.match(hub,/reactionCounts=\{like:0,love:0,celebrate:0,support:0,insightful:0\}/);
});

test('Single-reaction RPC toggles same choice off and replaces a previous choice',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.community_toggle_reaction/);
  assert.match(sql,/RETURNS integer/);
  assert.match(sql,/member_id uuid:=auth\.uid\(\)/);
  assert.match(sql,/p\.verification_status='approved'/);
  assert.match(sql,/m\.is_deleted=false/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/IF existing_reaction=target_reaction THEN/);
  assert.match(sql,/DELETE FROM public\.community_reactions/);
  assert.match(sql,/ON CONFLICT \(message_id,user_id\)/);
  assert.match(sql,/DO UPDATE SET reaction=EXCLUDED\.reaction/);
  assert.match(sql,/UNIQUE \(message_id,user_id\)/);
  assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.community_toggle_reaction\(uuid,text\)[\s\S]*FROM PUBLIC,anon/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.community_toggle_reaction\(uuid,text\)[\s\S]*TO authenticated,service_role/);
});

test('No legacy reaction records can be silently removed during main migration',()=>{
  assert.match(sql,/REVIEW ONLY — DO NOT RUN/);
  assert.match(sql,/IF duplicates>0 THEN/);
  assert.match(sql,/RAISE EXCEPTION[\s\S]*Multiple stored reactions detected/);
  assert.match(archive,/REVIEW ONLY — DO NOT RUN/);
  assert.match(archive,/CREATE TABLE IF NOT EXISTS dominionstar_private\.community_reactions_archived/);
  assert.match(archive,/ROW_NUMBER\(\) OVER/);
  assert.match(archive,/ORDER BY created_at DESC,id DESC/);
  assert.match(archive,/INSERT INTO dominionstar_private\.community_reactions_archived/);
  assert.match(archive,/Archive verification failed/);
  const archived=archive.indexOf('INSERT INTO dominionstar_private.community_reactions_archived');
  const deleted=archive.indexOf('DELETE FROM public.community_reactions');
  assert.ok(archived>=0&&deleted>archived,'archive precedes deletion');
});

test('Five Community reactions are readable, compact, and visually distinct',()=>{
  assert.match(html,/dominionstar-community-reactions\.css\?v=five-reactions-20261105/);
  assert.match(html,/community-hub\.js\?v=five-reactions-20261105/);
  assert.match(css,/#communityApp \.community-reaction-row\{/);
  assert.match(css,/flex-wrap:wrap!important/);
  assert.match(css,/min-height:36px!important/);
  assert.match(css,/width:17px!important;height:17px!important/);
  assert.match(css,/data-reaction="love"\]\.is-active/);
  assert.match(css,/color:#ff95a4!important/);
});

test('Browser harness exercises actual selectors without Supabase access',()=>{
  assert.match(browser,/DSDashboardSocial\.mount/);
  assert.match(browser,/await pick\('love'\)/);
  assert.match(browser,/await pick\('celebrate'\)/);
  assert.match(browser,/await pick\('support'\)/);
  assert.match(browser,/data-social="comment"/);
  assert.match(browser,/data-social="share"/);
  assert.match(browser,/data-social="repost"/);
  assert.match(browser,/SOCIAL_INTERACTIONS_BROWSER_PASS/);
  assert.doesNotMatch(browser,/SUPABASE_SERVICE_ROLE_KEY|ckmurvhjumzlhsegncba|signInWithPassword/);
});
