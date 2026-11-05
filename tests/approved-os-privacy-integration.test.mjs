import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const profile=read('assets/js/professional-profile.js');
const html=read('professional-profile/index.html');
const directory=read('assets/js/member-directory.js');
const messages=read('assets/js/direct-messages.js');
const community=read('assets/js/community-hub.js');
const auth=read('assets/js/member-auth.js');
const sql=read('scripts/security/member-public-projection-prepare.DO-NOT-RUN.review.sql');
const finalSQL=read('scripts/security/member-public-projection-enforce.DO-NOT-RUN.review.sql');

test('cross-member Profile is a read-only route and cannot fall through into editable own profile',()=>{
  assert.match(profile,/const requestedMemberId = new URLSearchParams\(location\.search\)\.get\('member'\)/);
  assert.match(profile,/if\(requestedMemberId && requestedMemberId!==session\.user\.id\)/);
  assert.match(profile,/const invalidId=!\//);
  assert.match(profile,/viewer\.data\?\.verification_status!=='approved'/);
  assert.match(profile,/document\.getElementById\('ownProfileLayout'\)\?\.classList\.add\('member-hidden'\)/);
  assert.match(profile,/document\.getElementById\('memberPublicProfile'\)\?\.classList\.remove\('member-hidden'\)/);
  assert.match(profile,/\}\s*catch\(_error\)\{[^\n]*Member initials remain available/);
  assert.match(profile,/\n    return;\n  \}\n\n  await supabase\.rpc\('ensure_member_profile'\)/);
});

test('peer Profile queries public-safe projection after staging flag with no private-data fallback',()=>{
  assert.match(profile,/const publicDirectoryV2=window\.DOMINIONSTAR_AGENT_DATA_FEATURES\?\.publicMemberProfilesV2===true/);
  assert.match(profile,/\.from\(publicDirectoryV2\?'member_public_profiles':'member_profiles'\)/);
  const branch=profile.slice(profile.indexOf('const requestedMemberId'),profile.indexOf("await supabase.rpc('ensure_member_profile')"));
  const select=branch.match(/\.select\('([^']+)'\)\s*\.eq\('id',requestedMemberId\)/);
  assert.ok(select,'The peer Profile must use a fixed explicit field selection');
  const fields=select[1].split(',');
  for(const sensitive of ['email','phone','address_line1','address_line2','postal_code','agent_code','smd_name','account_notes','role','is_founder']){
    assert.ok(!fields.includes(sensitive),'Peer Profile cannot select '+sensitive);
  }
  assert.match(branch,/\.eq\('id',requestedMemberId\)\.eq\('verification_status','approved'\)/);
  assert.doesNotMatch(branch,/\.select\('\*'\)/);
  assert.doesNotMatch(branch,/\.from\('member_profiles'\)[\s\S]*requestedMemberId/);
  assert.match(auth,/publicMemberProfilesV2:false/);
});

test('peer Profile layout does not render account codes or internal assignment',()=>{
  const start=html.indexOf('<section id="memberPublicProfile"');
  const end=html.indexOf('<section id="ownProfileLayout"');
  assert.ok(start>0&&end>start);
  const peer=html.slice(start,end);
  for(const id of ['memberPublicCode','memberPublicSmd'])assert.ok(!peer.includes(id));
  assert.doesNotMatch(peer,/>Agent code<|>SMD</i);
  assert.match(peer,/id="memberPublicName"/);
  assert.match(peer,/id="memberPublicPhoto"/);
  assert.match(peer,/id="memberPublicInitials"/);
  assert.match(peer,/id="memberPublicMessage"/);
  assert.match(peer,/id="memberPublicLocation"/);
  assert.match(peer,/id="memberPublicFounding"/);
  assert.match(peer,/Account codes, internal assignment, contact information and private notes are not displayed/);
});

test('approved member directory retains nonblocking photos without querying private columns in safe mode',()=>{
  assert.match(directory,/const directoryTable=publicDirectoryV2\?'member_public_profiles':'member_profiles'/);
  assert.match(directory,/const directoryFields=publicDirectoryV2/);
  assert.match(directory,/\? 'id,full_name,preferred_name,rank,city,state,avatar_path,exclusive_member_number'/);
  assert.match(directory,/const cards=filtered\.map\(m=>/);
  assert.match(directory,/id="directoryRetry"/);
  assert.match(directory,/if\(!url\|\|version!==renderVersion\)return/);
});

test('Messages and Community compose approved visuals with safe peer access',()=>{
  assert.match(messages,/\.from\(publicDirectoryV2\?'member_public_profiles':'member_profiles'\)/);
  assert.match(messages,/publicDirectoryV2 \? 'Private'/);
  assert.match(messages,/class="dm-avatar-photo"/);
  assert.match(community,/\.from\(publicDirectoryV2\?'member_public_profiles':'member_profiles'\)/);
  assert.match(community,/dsx-inline-action-icon/);
});

test('no unapproved database migration runs as part of the integration',()=>{
  assert.match(sql,/REVIEW ONLY — DO NOT RUN/);
  assert.match(finalSQL,/REVIEW ONLY — DO NOT RUN/);
  assert.match(finalSQL,/DROP POLICY "profile approved directory read"/);
  assert.match(sql,/profile_visibility='members'/);
});
