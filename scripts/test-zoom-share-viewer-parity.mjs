import fs from 'node:fs';

const css = fs.readFileSync('assets/css/meet/dock-layout-v2.css', 'utf8');
const executive = fs.readFileSync('assets/js/meet-next/executive6.js', 'utf8');

const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) throw new Error(message);
};

requireMatch(css, /\.remote-tile \.tile-overlay\s*\{[\s\S]*?inset:\s*0\s*!important/i,
  'Participant tile overlay must span the full video tile so hover controls are not positioned from the bottom nameplate.');
requireMatch(css, /\.remote-tile \.tile-overlay > span:first-child\s*\{[\s\S]*?bottom:\s*6px\s*!important/i,
  'Participant identity must remain bottom anchored.');
requireMatch(css, /\.remote-tile \.tile-hover-actions\s*\{[\s\S]*?top:\s*7px\s*!important/i,
  'Participant moderation controls must occupy the top hover layer.');
requireMatch(css, /\.remote-tile:hover \.tile-hover-actions[\s\S]*?opacity:\s*1\s*!important/i,
  'Participant tile controls must appear on pointer intent.');
requireMatch(css, /\.remote-tile:not\(\.local-dock-tile\) \.tile-overlay > \.tile-mic[\s\S]*?display:\s*none\s*!important/i,
  'Remote microphone state must not compete with the bottom identity nameplate.');
requireMatch(executive, /ids\.sharePresenterControls\.hidden\s*=\s*state\.sharingParticipantId!==['"]self['"]/,
  'Presenter controls must remain presenter-only.');
requireMatch(executive, /shareViewerMoreBtn\.hidden\s*=\s*state\.sharingParticipantId===['"]self['"]/,
  'Viewer shared-screen options must remain hidden from the presenter.');
requireMatch(executive, /Request Remote Control/,
  'Viewer share menu must retain remote-control capability when available.');
requireMatch(executive, /Stop Participant Share/,
  'Host/co-host viewer share menu must retain authority to stop a participant share.');

console.log('DOMINIONSTAR_ZOOM_SHARE_VIEWER_PARITY_OK');
