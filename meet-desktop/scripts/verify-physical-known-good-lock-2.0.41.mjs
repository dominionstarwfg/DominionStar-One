import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Physical-Mac known-good lock.
// These surfaces were already proven on the user's physical Mac and are not
// allowed to drift while we repair unrelated failing layers. If a future
// physical test proves one of these surfaces itself is defective, update the
// implementation first and then deliberately update this lock in the same
// narrowly scoped change with the physical evidence noted in the commit.

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const locked=new Map([
  ['ui/share-picker.html','b6658cc55c0ecdc59b72bfbc21de8f98813d475a'],
  ['ui/share-picker.css','de5fb436f814802375b70e6b0bffa25bccf393be'],
  ['ui/share-picker.js','4d4a49c44e79cf4b8ba50359aed6dab0907dd6c3'],
  // Physical Mac evidence on 2026-09-15 proved Stop Share remained active and
  // did not restore the meeting. The controller was therefore deliberately
  // repaired to stop local capture tracks before asynchronous chrome cleanup.
  ['ui/share-controller.js','f6ca56fd2bd6b1f8834dfadbae9d883482465d46'],
  ['ui/mac-presenter-toolbar.html','0654b7f203dd7239b1e8e375e1a664e026165566'],
  ['ui/mac-presenter-toolbar.css','60a5da68f962ae423b10e12fd1f21fecfdddd55d']
]);

function gitBlobSha(buffer){
  const header=Buffer.from(`blob ${buffer.length}\0`,'utf8');
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

const failures=[];
for(const [relative,expected] of locked){
  const absolute=path.join(root,relative);
  if(!fs.existsSync(absolute)){failures.push(`${relative}: missing`);continue;}
  const actual=gitBlobSha(fs.readFileSync(absolute));
  if(actual!==expected)failures.push(`${relative}: expected ${expected}, got ${actual}`);
}

if(failures.length){
  console.error('PHYSICAL_KNOWN_GOOD_LOCK_FAILED');
  for(const failure of failures)console.error(`- ${failure}`);
  console.error('Do not update the lock just to make CI green. A lock change requires a physical-Mac defect on that exact surface.');
  process.exit(1);
}

console.log('PHYSICAL_KNOWN_GOOD_LOCK_OK',JSON.stringify([...locked.keys()]));