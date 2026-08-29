import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=rel=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const html=read('ui/index.html');
const styles=read('ui/styles.css');
const meeting=read('ui/meeting.css');
const zoom=read('ui/zoom-behavior.css');
const shareCss=read('ui/share.css');
const shareIntegration=read('ui/share-integration.js');
const sharePicker=read('ui/share-picker.js');
const presenter=read('ui/presenter-toolbar.html');
const app=read('ui/app.js');

for(const [name,source] of Object.entries({html,styles,meeting,zoom,shareCss,shareIntegration,sharePicker,presenter,app})){
  assert(!source.includes('\uFFFD'),`${name} contains a Unicode replacement character.`);
}

const requiredTokens={
  '--bg':'#07111f',
  '--text':'#f5f7fb',
  '--gold':'#e5b842',
  '--blue':'#2f80ed',
  '--green':'#22b66f',
  '--danger':'#e84e61'
};
for(const [token,value] of Object.entries(requiredTokens)){
  assert(styles.includes(`${token}:${value}`),`Production color token ${token} must remain ${value}.`);
}

const svgCount=(html.match(/<svg\b/g)||[]).length;
assert(svgCount>=10,'Production shell must retain modern vector icons.');
assert(!/[\u{1F300}-\u{1FAFF}]/u.test(html),'Production shell must not use emoji as primary navigation/action icons.');

for(const label of ['New Meeting','Join','Schedule','Share Screen']){
  assert(html.includes(label),`Home action label is missing: ${label}`);
}

assert(shareIntegration.includes("button.id='roomShare'"),'Share integration must create the in-meeting Share Screen control.');
assert(shareIntegration.includes("button.textContent='Share Screen'"),'Share Screen control text must remain explicit.');
for(const command of ['pause','new-share','stop','annotate','participants','chat']){
  assert(shareIntegration.includes(command),`Share presenter command missing: ${command}`);
}
for(const text of ['Screens','Applications','Share computer sound','Optimize for video']){
  assert((read('ui/share-picker.html')+sharePicker).includes(text),`Share picker text is missing: ${text}`);
}
for(const text of ['Mute','Stop Video','Participants','Leave']){
  assert((app+presenter).includes(text),`Meeting control text is missing: ${text}`);
}

assert(styles.includes('.action-icon svg'),'Home action icons must use the vector icon system.');
assert(styles.includes('.new-meeting')&&styles.includes('.join .action-icon')&&styles.includes('.schedule .action-icon')&&styles.includes('.share .action-icon'),'Home action state colors must remain explicitly styled.');
assert(shareCss.includes('share-active'),'Active-share layout styling must remain present.');
assert(zoom.length>1000,'Zoom-behavior visual layer unexpectedly missing.');

console.log(`DOMINIONSTAR_PRODUCTION_VISUAL_POLISH_OK svg=${svgCount} palette=navy-gold-blue-green-danger share=complete text=clean`);
