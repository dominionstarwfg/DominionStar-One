// DominionStar web Agent Dashboard release guard (build-time only).
// This is not a replacement for production RLS, OAuth and real-browser QA.
import {readFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {resolve, join, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot=resolve(process.argv[2] || join(sourceRoot,'public-dist'));
const safeRead=(root,path)=>readFileSync(join(root,path),'utf8');
const check=(ok,reason)=>{if(!ok)throw new Error('AGENT_RELEASE_BLOCKED: '+reason)};
const flags=safeRead(publicRoot,'assets/js/member-login-google-flags.js');
const notificationFlags=safeRead(publicRoot,'assets/js/notification-feature-flags.js');
const messages=safeRead(publicRoot,'assets/js/direct-messages.js');
const receiver=safeRead(publicRoot,'assets/js/global-call-manager.js');
const policy=safeRead(sourceRoot,'scripts/security/agent-call-realtime-v2.DO-NOT-RUN.review.sql');
const packageJson=JSON.parse(safeRead(publicRoot,'package.json'));
const packageLockPath=join(publicRoot,'package-lock.json');

check(existsSync(packageLockPath),
  'package-lock.json is missing; server dependency graph is not reproducible');
const packageLock=JSON.parse(safeRead(publicRoot,'package-lock.json'));
check(packageLock.lockfileVersion===3,'package-lock.json must use lockfileVersion 3');
for(const dependency of ['@supabase/supabase-js','resend','web-push']){
  const version=String(packageJson.dependencies?.[dependency]||'');
  check(/^\d+\.\d+\.\d+$/.test(version),
    dependency+' must be pinned to an exact version');
  check(packageLock.packages?.['']?.dependencies?.[dependency]===version,
    dependency+' root lock dependency does not match package.json');
  check(packageLock.packages?.['node_modules/'+dependency]?.version===version,
    dependency+' resolved lock version does not match package.json');
}

// Neither OAuth nor identity linking can be released with incomplete provider,
// redirect and RLS end-to-end validation. Review and update this gate in an
// explicitly authorized, coordinated production release.
check(/googleSignIn\s*:\s*false\b/.test(flags),'Google sign-in is no longer disabled');
check(/googleIdentityLinking\s*:\s*false\b/.test(flags),'Google identity linking is no longer disabled');
check(!/googleSignIn\s*:\s*true\b|googleIdentityLinking\s*:\s*true\b/.test(flags),
 'Google feature enablement found in shipped flags');
check(/Object\.freeze\s*\(/.test(flags),'Google feature configuration is no longer immutable');

// True closed-browser push and trusted database-authored message events require
// a coordinated production SQL + Netlify secret release. Keep both off until
// that release is explicitly authorized and verified.
check(/trustedMessageEvents\s*:\s*false\b/.test(notificationFlags),
  'Trusted message-event notifications are no longer disabled');
check(/webPush\s*:\s*false\b/.test(notificationFlags),
  'Closed-browser Web Push is no longer disabled');
check(!/trustedMessageEvents\s*:\s*true\b|webPush\s*:\s*true\b/.test(notificationFlags),
  'Notification production gate enabled in distributable flags');
check(/Object\.freeze\s*\(/.test(notificationFlags),
  'Notification feature configuration is no longer immutable');

// Both call clients must opt in together and must not silently change the
// currently shipping legacy channel names. Private v2 stays off until RLS is
// authorized, tested in isolated staging and released through a separate gate.
for(const [name,source] of [['direct-messages',messages],['global-call-manager',receiver]]){
 check(source.includes('window.DOMINIONSTAR_CALL_PRIVATE_V2 === true'),
   name+' no longer has the explicit private v2 gate');
 check(source.includes("...(privateCallV2 ? {private:true} : {})"),
   name+' private-channel configuration is no longer conditional');
 check(source.includes("ds-call-v2:") && source.includes("ds-call-inbox-v2:"),
   name+' private channel names are missing');
 check(source.includes("dominionstar-user-call-") && source.includes("dominionstar-call"),
   name+' legacy transport fallback is missing');
}
check(policy.split(/\r?\n/).every(line=>!line.trim()||line.trim().startsWith('--')),
 'Review-only Realtime policy contains executable SQL');
check(policy.includes('DO NOT RUN'),'Review policy no longer carries the do-not-run guard');

// Reject direct feature activation in distributable member HTML/JavaScript.
// This is a deployment tripwire, not a permission boundary; the backend must
// still independently enforce all authorization rules.
const roots=['assets/js','member-dashboard','member-login','direct-messages','account-settings'];
const files=[];
for(const root of roots){
 const folder=join(publicRoot,root);
 const walk=dir=>{
   for(const entry of readdirSync(dir,{withFileTypes:true})){
     const path=join(dir,entry.name);
     if(entry.isDirectory())walk(path);
     else if(entry.isFile() && /\.(js|html)$/.test(entry.name))files.push(path);
   }
 };
 walk(folder);
}
const allowed=new Set(['assets/js/direct-messages.js','assets/js/global-call-manager.js']);
for(const file of files){
 const rel=relative(publicRoot,file).replaceAll('\\','/');
 const source=readFileSync(file,'utf8');
 if(!allowed.has(rel)){
   check(!source.includes('DOMINIONSTAR_CALL_PRIVATE_V2'),
     'Unexpected private calling release flag reference in '+rel);
 }
 // Reject obvious programmatic activations; a user can always change local
 // JS in devtools, so none of this should be mistaken for RLS enforcement.
 check(!/DOMINIONSTAR_CALL_PRIVATE_V2\s*(?:=|:)\s*true\b/.test(source),
   'Private calling enabled in '+rel);
}
console.log('DOMINIONSTAR_AGENT_RELEASE_GATES_OK');
console.log('Protected default: Google sign-in OFF, identity linking OFF, private calling v2 OFF, trusted message events OFF, Web Push OFF');
