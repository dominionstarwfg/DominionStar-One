import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const guard=join(root,'scripts/check-agent-release-gates.mjs');
const sources=[
 'assets/js/member-login-google-flags.js',
 'assets/js/notification-feature-flags.js',
 'assets/js/direct-messages.js',
 'assets/js/global-call-manager.js'
];
const prepare=()=>{
 const dir=mkdtempSync(join(tmpdir(),'dominionstar-agent-release-'));
 for(const folder of ['member-dashboard','member-login','direct-messages','account-settings','assets/js']){
   mkdirSync(join(dir,folder),{recursive:true});
 }
 for(const path of sources) copyFileSync(join(root,path),join(dir,path));
 copyFileSync(join(root,'package.json'),join(dir,'package.json'));
 // Unit fixture represents a reproducible packaged build. The production
 // repository itself must still carry a real npm-generated lockfile.
 writeFileSync(join(dir,'package-lock.json'),'{}\n');
 return dir;
};
const verify=dir=>execFileSync(process.execPath,[guard,dir],{encoding:'utf8',timeout:7000});
const withFixture=callback=>{
 const dir=prepare();
 try{return callback(dir)}finally{rmSync(dir,{recursive:true,force:true})}
};
const change=(dir,path,from,to)=>{
 const file=join(dir,path),source=readFileSync(file,'utf8');
 assert.ok(source.includes(from),'Source text for negative case must exist');
 writeFileSync(file,source.replace(from,to));
};

test('Website Agent release gate accepts current disabled features',()=>withFixture(dir=>{
 assert.match(verify(dir),/DOMINIONSTAR_AGENT_RELEASE_GATES_OK/);
}));
test('Website release blocks accidental Google sign-in activation',()=>withFixture(dir=>{
 change(dir,sources[0],'googleSignIn: false','googleSignIn: true');
 assert.throws(()=>verify(dir),/AGENT_RELEASE_BLOCKED/);
}));
test('Website release blocks accidental Google identity-linking activation',()=>withFixture(dir=>{
 change(dir,sources[0],'googleIdentityLinking: false','googleIdentityLinking: true');
 assert.throws(()=>verify(dir),/AGENT_RELEASE_BLOCKED/);
}));
test('Website release refuses a unilateral private call protocol change',()=>withFixture(dir=>{
 change(dir,sources[1],
   'window.DOMINIONSTAR_CALL_PRIVATE_V2 === true',
   'window.DOMINIONSTAR_CALL_PRIVATE_V2 !== false');
 assert.throws(()=>verify(dir),/AGENT_RELEASE_BLOCKED/);
}));
test('Website release catches unexpected inline private call enablement',()=>withFixture(dir=>{
 writeFileSync(join(dir,'member-dashboard/unsafe.js'),
   'window.DOMINIONSTAR_CALL_PRIVATE_V2 = true;');
 assert.throws(()=>verify(dir),/AGENT_RELEASE_BLOCKED/);
}));
test('Netlify build invokes release guard before staging rewrite',()=>{
 const build=readFileSync(join(root,'scripts/build-public-netlify.sh'),'utf8');
 const gate=build.indexOf('node "$ROOT/scripts/check-agent-release-gates.mjs" "$DIST"');
 const staging=build.indexOf('prepare-isolated-staging.mjs');
 assert.ok(gate>0 && staging>gate,'Gate must run before staging rewrite');
});
