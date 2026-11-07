import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../assets/css/dominionstar-cinematic-os.css',import.meta.url),'utf8');

test('Feed composer text remains readable against dark navy surfaces',()=>{
  assert.match(css,/\.dsx-feed-page-composer label,[\s\S]*color:var\(--dsx-text-strong\)!important/);
  assert.match(css,/\.dsx-feed-page-composer textarea\{[\s\S]*background:#071b35!important[\s\S]*color:#f3f7fb!important/);
  assert.match(css,/\.dsx-feed-page-composer textarea::placeholder\{[\s\S]*color:#91a9c2!important/);
  assert.match(css,/\.dsx-feed-page-composer \.dsmedia-note,[\s\S]*color:#b9cadc!important/);
});

test('Social posts preserve a visible text hierarchy',()=>{
  assert.match(css,/\.ds30-social-post,[\s\S]*linear-gradient\(150deg,#12345f 0%,#0c284d 52%,#081f3d 100%\)!important/);
  assert.match(css,/\.ds30-post-author strong,[\s\S]*color:#ffffff!important/);
  assert.match(css,/\.ds30-post-copy,[\s\S]*color:#edf3fa!important/);
  assert.match(css,/\.ds30-post-engagement,[\s\S]*color:#a8bbcf!important/);
});

test('semantic active reaction colors remain unmistakable',()=>{
  assert.match(css,/\.ds30-react-main\.reaction-like\{[\s\S]*color:#73b2ff!important/);
  assert.match(css,/\.ds30-react-main\.reaction-love\{[\s\S]*color:#ff7180!important/);
  assert.match(css,/\.ds30-react-main\.reaction-celebrate\{[\s\S]*color:#f5d266!important/);
  assert.match(css,/\.ds30-react-main\.reaction-support\{[\s\S]*color:#72e2a8!important/);
  assert.match(css,/\.ds30-react-main\.reaction-insightful\{[\s\S]*color:#c2b6ff!important/);
});
