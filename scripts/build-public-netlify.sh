#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/public-dist"
MEET_SOURCE="$ROOT/meet-desktop/ui"
MEET_DIST="$DIST/meet"

# Netlify Deploy Previews are useful for visual QA, but an unconfigured
# PR preview must never inherit DominionStar's production backend.
# Publish a static, backend-free visual review package: real HTML/CSS and
# approved layout proportions, with production-backed scripts/actions disabled.
if [[ "${CONTEXT:-}" == "deploy-preview" &&
      "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" != "STAGING_ONLY" ]]; then
  rm -rf "$DIST"
  mkdir -p "$DIST"

  rsync -a "$ROOT/" "$DIST/" \
    --exclude '.git/' \
    --exclude '.github/' \
    --exclude '.env' \
    --exclude '.env.*' \
    --exclude 'tests/' \
    --exclude 'netlify.toml' \
    --exclude 'public-dist/' \
    --exclude 'rebuild-dist/' \
    --exclude 'meet-desktop/' \
    --exclude 'desktop/' \
    --exclude 'desktop 2/' \
    --exclude 'scripts/' \
    --exclude 'supabase/' \
    --exclude 'netlify/' \
    --exclude 'node_modules/' \
    --exclude '*.md' \
    --exclude '*.zip'

  mkdir -p "$DIST/assets/css"
  cat > "$DIST/assets/css/dominionstar-visual-review.css" <<'CSS'
html{background:#061225!important}
body:before{
  content:"VISUAL REVIEW ONLY · backend disabled";
  position:fixed;left:50%;top:7px;z-index:2147483647;
  transform:translateX(-50%);
  padding:5px 10px;border-radius:999px;
  background:#0b2343;color:#f5d47e;
  border:1px solid rgba(240,193,91,.45);
  box-shadow:0 7px 20px rgba(0,0,0,.28);
  font:800 10px/1.2 system-ui,sans-serif;letter-spacing:.08em;
  pointer-events:none
}
#feedGate,#communityGate,#dmGate,#notificationGate,#directoryGate,
#agentJourneyGate,#agentLearningGate,#appointmentGate,#profileGate,#settingsGate{display:none!important}
#feedApp,#communityApp,#dmApp,#notificationApp,#directoryApp,
#agentJourneyApp,#agentLearningApp,#appointmentApp,#profileApp,#settingsApp{display:block!important}
button,input,select,textarea,form{pointer-events:none!important}
a{cursor:pointer!important}
.member-hidden[data-preview-show="true"]{display:block!important}
img:not([src]),img[src=""],img[src="#"],img[data-preview-broken="true"],video:not([src]),source:not([src]){display:none!important}
.ds-review-post{padding:13px 14px;border:1px solid rgba(126,168,221,.2);border-radius:13px;background:linear-gradient(155deg,rgba(20,42,75,.96),rgba(7,24,48,.98));box-shadow:0 12px 28px rgba(0,0,0,.16)}
.ds-review-post+.ds-review-post{margin-top:9px}.ds-review-author{display:flex;align-items:center;gap:9px}.ds-review-avatar{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(240,193,91,.55);background:#173354;color:#f3cf7c;font-weight:900}
.ds-review-author strong{display:block;font-size:12px}.ds-review-author small{display:block;color:#8fa7c0;font-size:9.5px;margin-top:2px}.ds-review-post p{margin:10px 0;color:#c3d0df;font-size:11.5px;line-height:1.55}.ds-review-engagement{display:flex;gap:16px;color:#8ea5bd;font-size:9.5px}.ds-review-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:9px;padding-top:8px;border-top:1px solid rgba(126,168,221,.13)}.ds-review-actions span{min-height:34px;display:flex;align-items:center;justify-content:center;gap:7px;padding:6px;border-radius:8px;text-align:center;color:#c1d0df;font-size:9.5px;font-weight:800}.ds-review-actions .like{color:#78afff;background:rgba(24,119,242,.09)}
.ds-review-action-icon{width:16px;height:16px;display:block;flex:0 0 16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ds-review-actions .active-like{color:#72acff!important;background:rgba(24,119,242,.14)!important}
.ds-review-actions .active-love{color:#ff7180!important;background:rgba(255,59,85,.13)!important}
.ds-review-actions .comment-action{color:#d5e4f3}.ds-review-actions .repost-action{color:#67cdfb}.ds-review-actions .share-action{color:#82b9ff}
.ds-review-actions .celebrate{color:#f5cf73}.ds-review-actions .support{color:#72e6ab}.ds-review-actions .insightful{color:#c3b7ff}
.ds-review-actions .dsx-inline-action-icon{width:15px;height:15px;flex:0 0 15px}
.ds-review-actions .active-like{color:#78afff;background:rgba(24,119,242,.11)}
.ds-review-actions .active-love{color:#ff7d88;background:rgba(255,77,90,.10)}
.ds-review-reaction-summary{display:inline-flex;align-items:center;gap:3px;margin-right:8px}
.ds-review-reaction-dot{width:18px;height:18px;display:inline-grid;place-items:center;border-radius:50%;font-size:10px;border:2px solid #0b1f3b;margin-right:-5px}
.ds-review-reaction-dot.like{background:#1877f2}.ds-review-reaction-dot.love{background:#ff3b55}.ds-review-reaction-dot.celebrate{background:#d79b32}
.ds-review-reaction-dot svg{width:11px;height:11px;display:block;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ds-review-reaction-dot.love svg,.ds-review-reaction-dot.celebrate svg{fill:#fff}
.ds-review-post-photo{display:block!important;width:100%!important;max-height:430px!important;object-fit:cover!important;margin:10px 0!important;border-radius:12px!important;border:1px solid rgba(126,168,221,.18)!important;background:#071a35!important}
.ds-review-photo-caption{margin:8px 0 10px!important;color:#edf3fa!important;font-size:11.5px!important;line-height:1.55!important}
.ds-review-post-media-shell{padding:0 12px 4px}
.ds-review-author{position:relative}.ds-review-pinned{margin-left:auto;color:#f2c75f;font-size:9px}.ds-review-post-title{margin:10px 0 4px;color:#fff;font-size:13px;letter-spacing:.01em}
.ds-review-feature-media{min-height:92px;display:flex;align-items:center;justify-content:space-between;gap:18px;margin:10px 0;padding:14px 18px;border-radius:12px;border:1px solid rgba(240,193,91,.28);background:radial-gradient(circle at 78% 50%,rgba(248,184,63,.26),transparent 29%),linear-gradient(115deg,#071a35 0%,#0f3560 52%,#735720 100%);box-shadow:inset 0 1px rgba(255,255,255,.04),0 10px 22px rgba(0,0,0,.18)}
.ds-review-feature-media strong{font:900 15px/1 Georgia,serif;color:#f5d17b;letter-spacing:.06em}.ds-review-feature-media span{font:800 20px/1.05 Georgia,serif;color:#f4f7fb}.ds-review-feature-media em{color:#f0c15b;font-style:normal}
.ds-review-event{display:grid;gap:4px}.ds-review-event h3{margin:2px 0;font-size:12.5px}.ds-review-event p,.ds-review-event small{margin:0;color:#9fb3ca;font-size:9.5px}.ds-review-event a{margin-top:5px;padding:7px 9px;border-radius:8px;background:#1877f2;color:#fff!important;text-align:center;text-decoration:none;font-size:10px;font-weight:800}
.ds-review-conversation{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:8px;align-items:center;width:100%;padding:9px;border:0;border-radius:9px;background:transparent;color:#eef4fb;text-align:left}.ds-review-conversation.active{background:rgba(24,119,242,.12);box-shadow:inset 3px 0 #1877f2}.ds-review-conversation .avatar{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:#173354;color:#f2cf7c;font-weight:900}.ds-review-conversation strong,.ds-review-conversation small{display:block}.ds-review-conversation strong{font-size:11px}.ds-review-conversation small{margin-top:2px;color:#8fa5bd;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ds-review-conversation time{font-size:8.5px;color:#7087a1}.ds-review-message{display:flex;margin:8px 0}.ds-review-message.mine{justify-content:flex-end}.ds-review-bubble{max-width:65%;padding:9px 11px;border-radius:12px;background:#243d5c;color:#eef4fb;font-size:10.5px;line-height:1.45}.ds-review-message.mine .ds-review-bubble{background:linear-gradient(145deg,#1877f2,#0d63d9);color:#fff}.ds-review-bubble small{display:block;margin-top:4px;opacity:.7;font-size:8px}
body.ds-visual-review .dm-member-panel{display:block!important}
body.ds-visual-review img:not([src="/assets/logo.jpeg"]):not([src="/assets/founder-blue.jpeg"]){display:none!important}
body.ds-visual-review video,body.ds-visual-review iframe,body.ds-visual-review object,body.ds-visual-review embed{display:none!important}
body.ds-visual-review .dm-welcome{display:none!important}
CSS

  mkdir -p "$DIST/assets/js"
  cat > "$DIST/assets/js/dominionstar-visual-review-fixtures.js" <<'JS'
(()=>{
  'use strict';
  const run=()=>{
  const byId=id=>document.getElementById(id);
  const set=(id,value)=>{const el=byId(id);if(el)el.textContent=value};
  const html=(id,value)=>{const el=byId(id);if(el)el.innerHTML=value};
  const show=id=>{const el=byId(id);if(el)el.classList.remove('member-hidden')};

  document.body.classList.add('ds-visual-review');

  // Shared preview identity. This is visual-review sample content only.
  for(const id of ['topbarMemberName','heroProfileFullName','feedPageName'])set(id,'Levismous Aken');
  for(const id of ['topbarContractLevel','heroContractLevel','feedPageRank'])set(id,'Contract Level: SMD');
  set('heroMemberName','Levismous');
  set('topbarFoundingBadge','Founding Member #01');
  set('heroFoundingBadge','Founding Member #01');
  set('feedPageFounding','Founding Member #01');
  ['dashboardAvatar','heroProfileAvatar','dashboardComposerAvatar','feedPageAvatar'].forEach(id=>{
    const img=byId(id); if(!img)return;
    img.src='/assets/founder-blue.jpeg';
    img.classList.remove('member-hidden');
    const initials=img.parentElement?.querySelector('.dsos-avatar-initials');
    initials?.classList.add('member-hidden');
  });
  show('topbarFoundingBadge');show('heroFoundingBadge');show('feedPageFounding');

  const likeBadge='<i class="ds-review-reaction-dot like" title="Like"><svg viewBox="0 0 24 24"><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8a3 3 0 0 1 2 3v4h6a2 2 0 0 1 2 2l-2 8a3 3 0 0 1-3 2H7"/></svg></i>';
  const likeAction='<svg class="ds-review-action-icon" viewBox="0 0 24 24"><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8a3 3 0 0 1 2 3v4h6a2 2 0 0 1 2 2l-2 8a3 3 0 0 1-3 2H7"/></svg>';
  const loveAction='<svg class="ds-review-action-icon" viewBox="0 0 24 24"><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/></svg>';
  const commentAction='<svg class="ds-review-action-icon" viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/></svg>';
  const repostAction='<svg class="ds-review-action-icon" viewBox="0 0 24 24"><path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
  const shareAction='<svg class="ds-review-action-icon" viewBox="0 0 24 24"><path d="m15 8 5-5 5 5"/><path d="M20 3v12"/><path d="M20 15H8a5 5 0 0 0-5 5v1"/></svg>';
  const loveBadge='<i class="ds-review-reaction-dot love" title="Love"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/></svg></i>';
  const celebrateBadge='<i class="ds-review-reaction-dot celebrate" title="Celebrate"><svg viewBox="0 0 24 24"><path d="m12 2 1.8 5.3L19 9.1l-4.3 3.2 1.6 5.4L12 14.6l-4.3 3.1 1.6-5.4L5 9.1l5.2-1.8L12 2Z"/></svg></i>';

  // Dashboard representative state.
  set('journeyPercent','67%');set('journeyCount','4 of 6 milestones completed');
  set('activityMessages','12');set('activityNotifications','4');set('activityAnnouncements','3');
  set('dashboardJourneyPercentMirror','67%');
  set('journeyCurrentMission','Complete Leadership Foundations');
  set('journeyMissionStatus','4 of 6 milestones complete');
  const bar=byId('journeyProgressBar');if(bar)bar.style.width='67%';
  html('dashboardNextAppointment','<article class="ds-review-event"><span class="appointment-status confirmed">Upcoming</span><h3>Saving Your Future</h3><p>Wednesday · 8:00 PM CT</p><small>DominionStar weekly financial awareness session</small><a href="#">Join Meeting</a></article>');
  html('dashboardAnnouncementPreview','<article class="dsos-pinned-update"><div class="dsos-pinned-update-head"><span class="dsos-pinned-label">Founder update</span><small>Today</small></div><h3>Weekly leadership focus</h3><p>Build with consistency, serve with professionalism, and keep your team moving forward.</p><a class="dsos-inline-link dsx-announcement-read" href="#">Read Full Update →</a></article>');
  const post='<article class="ds-review-post ds-review-featured"><div class="ds-review-author"><span class="ds-review-avatar">LA</span><span><strong>Levismous Aken</strong><small>SMD · Founding Member #01 · Jul 22, 2026</small></span><b class="ds-review-pinned">★ Pinned</b></div><h3 class="ds-review-post-title">ZOOM MEETING – SAVING YOUR FUTURE</h3><p>Wednesday, July 22 · 9 PM ET · 8 PM CT · 6 PM PT</p><div class="ds-review-feature-media"><strong>DOMINIONSTAR</strong><span>Saving Your <em>Future</em></span></div><div class="ds-review-engagement"><span><span class="ds-review-reaction-summary">'+likeBadge+loveBadge+celebrateBadge+'</span>24 reactions</span><span>8 comments</span></div><div class="ds-review-actions"><span class="active-like">'+likeAction+'Like</span><span class="comment-action">'+commentAction+'Comment</span><span class="repost-action">'+repostAction+'Repost</span><span class="share-action">'+shareAction+'Share</span></div></article>';
  const dashboardSecond='<article class="ds-review-post"><div class="ds-review-author"><span class="ds-review-avatar">TM</span><span><strong>Team Member</strong><small>MD · 52m</small></span></div><p>Licensing milestone complete. Next focus is product training and consistent prospecting activity.</p><div class="ds-review-engagement"><span><span class="ds-review-reaction-summary">'+likeBadge+loveBadge+'</span>12 reactions</span><span>3 comments</span></div><div class="ds-review-actions"><span class="active-like">'+likeAction+'Like</span><span class="comment-action">'+commentAction+'Comment</span><span class="repost-action">'+repostAction+'Repost</span><span class="share-action">'+shareAction+'Share</span></div></article>';
  html('dashboardSocialPreview',post+dashboardSecond);

  // Full Feed representative density.
  const photoPost='<article class="ds-review-post ds-review-photo-post"><div class="ds-review-author"><span class="ds-review-avatar">LA</span><span><strong>Levismous Aken</strong><small>SMD · Founding Member #01 · 1h</small></span></div><p class="ds-review-photo-caption">Leadership is built through consistency, service, and helping the next person move forward. Proud of the progress across DominionStar this week.</p><div class="ds-review-post-media-shell"><img class="ds-review-post-photo" src="/assets/founder-blue.jpeg" alt="DominionStar leadership photo"></div><div class="ds-review-engagement"><span><span class="ds-review-reaction-summary">'+likeBadge+loveBadge+'</span>31 reactions</span><span>9 comments · 4 shares</span></div><div class="ds-review-actions"><span class="active-love">'+loveAction+'Love</span><span class="comment-action">'+commentAction+'Comment</span><span class="repost-action">'+repostAction+'Repost</span><span class="share-action">'+shareAction+'Share</span></div></article>';
  html('feedPageStream',post+photoPost);

  // Messages representative three-column state.
  html('dmConversationList','<button class="ds-review-conversation active"><span class="avatar">TM</span><span><strong>Team Member</strong><small>Great progress this week.</small></span><time>9:41</time></button><button class="ds-review-conversation"><span class="avatar">SA</span><span><strong>Senior Associate</strong><small>Can we review the training plan?</small></span><time>8:12</time></button><button class="ds-review-conversation"><span class="avatar">MD</span><span><strong>Marketing Director</strong><small>Meeting notes are ready.</small></span><time>Fri</time></button>');
  set('dmConnectionStatus','Online');set('dmActiveName','Team Member');set('dmActiveStatus','Online');
  html('dmThread','<article class="ds-review-message"><div class="ds-review-bubble">Good morning. I completed the training module and updated my prospect list.<small>9:32 AM</small></div></article><article class="ds-review-message mine"><div class="ds-review-bubble">Excellent. Keep the momentum. Let us review your next milestone this afternoon.<small>9:35 AM · Read</small></div></article><article class="ds-review-message"><div class="ds-review-bubble">Perfect. I will be ready.<small>9:36 AM</small></div></article>');
  set('dmMemberNameLarge','Team Member');set('dmMemberRole','Approved DominionStar member');
  set('dmMemberContract','MD');set('dmMemberAgentCode','DS-2048');set('dmMemberSmd','DominionStar Leadership');set('dmMemberStatus','Approved');set('dmMessageCount','48');set('dmLinkCount','3');set('dmUnreadCount','0');

  // Notifications representative state.
  html('notificationList','<a class="notification-item notification-communications unread" href="#"><span class="notification-item-icon">✉</span><div><strong>New message from a team member</strong><p>Your follow-up plan is ready for review.</p><small>10 minutes ago</small></div><b>New</b></a><a class="notification-item notification-journey" href="#"><span class="notification-item-icon">↗</span><div><strong>Journey milestone completed</strong><p>Leadership Foundations was marked complete.</p><small>1 hour ago</small></div></a><a class="notification-item notification-recognition" href="#"><span class="notification-item-icon">★</span><div><strong>Recognition update</strong><p>A new team achievement was posted.</p><small>Today</small></div></a>');
  set('notificationUnread','4');set('notificationMissed','1');set('notificationToday','7');

  // Community representative feed.
  html('communityFeed','<article class="ds-review-post"><div class="ds-review-author"><span class="ds-review-avatar">DS</span><span><strong>DominionStar Member</strong><small>Discussion · 32m</small></span></div><p>What is one practice that has improved your follow-up consistency this month?</p><div class="ds-review-actions"><span class="like">Like</span><span>Celebrate</span><span>Support</span><span>Insightful</span></div></article><article class="ds-review-post"><div class="ds-review-author"><span class="ds-review-avatar">TM</span><span><strong>Team Member</strong><small>Milestone · 2h</small></span></div><p>Completed another licensing milestone today. Appreciate the support from the team.</p><div class="ds-review-actions"><span class="like">Like</span><span>Celebrate</span><span>Support</span><span>Insightful</span></div></article>');

  // Show the same recognizable pictograms in backend-free Community and Inbox samples.
  const reviewSvg = path => '<svg class="dsx-inline-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';
  const reviewActionIcons={
    Like:['M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8a3 3 0 0 1 2 3v4h6a2 2 0 0 1 2 2l-2 8a3 3 0 0 1-3 2H7','like'],
    Celebrate:['m12 2 2.2 6.7L21 11l-5.6 4.2 2.1 6.8L12 18l-5.5 4 2.1-6.8L3 11l6.8-2.3L12 2','celebrate'],
    Support:['M4 12v-2a3 3 0 0 1 3-3h2l3 3 3-3h2a3 3 0 0 1 3 3v2M3 14l6 6h6l6-6','support'],
    Insightful:['M9 18h6M10 22h4M8.5 14.5a6 6 0 1 1 7 0c-.9.8-1.5 1.7-1.5 2.5h-4c0-.8-.6-1.7-1.5-2.5','insightful']
  };
  document.querySelectorAll('#communityFeed .ds-review-actions span').forEach(node=>{
    const label=node.textContent.trim();
    const config=reviewActionIcons[label];
    if(config){node.classList.add(config[1]);node.innerHTML=reviewSvg(config[0])+'<span>'+label+'</span>';}
  });
  const noticePaths=[
    'M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8Z',
    'M5 19 19 5M8 5h11v11',
    'M7 4h10v5a5 5 0 0 1-10 0V4ZM12 14v7M8 21h8'
  ];
  document.querySelectorAll('#notificationList .notification-item-icon').forEach((node,index)=>{
    node.innerHTML=reviewSvg(noticePaths[Math.min(index,noticePaths.length-1)]);
  });

  // Remove browser broken-image placeholders from source-less images.
  document.querySelectorAll('img').forEach(img=>{if(!img.getAttribute('src'))img.remove();else img.addEventListener('error',()=>img.remove(),{once:true});});
  document.querySelectorAll('video,iframe,object,embed').forEach(node=>node.remove());
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
JS

  python3 - "$DIST" <<'PY'
from pathlib import Path
import re, sys

dist=Path(sys.argv[1])
workspace_pages=[
  'member-dashboard/index.html','feed/index.html','direct-messages/index.html',
  'notifications/index.html','community/index.html','member-directory/index.html',
  'agent-journey/index.html','agent-learning/index.html','appointments/index.html',
  'professional-profile/index.html','account-settings/index.html'
]
keep_scripts=('dominionstar-agent-nav-shell.js',)

for rel in workspace_pages:
    p=dist/rel
    if not p.exists():
        continue
    html=p.read_text(encoding='utf-8')

    # Keep only the local navigation shell. Remove auth, Supabase, realtime,
    # functions, and every other production-backed script from visual previews.
    def strip_script(match):
        tag=match.group(0)
        return tag if any(name in tag for name in keep_scripts) else ''
    html=re.sub(r'<script\b[^>]*>.*?</script>', strip_script, html, flags=re.I|re.S)

    # Force authenticated styling for shared-shell pages. The Executive Dashboard
    # already owns its own dsos-shell/sidebar; adding ds-auth-os-shell-active there
    # would double-apply the left rail offset and distort visual review geometry.
    if rel == 'member-dashboard/index.html':
        html=re.sub(
            r'<body([^>]*)class="([^"]*)"',
            lambda m: '<body'+m.group(1)+'class="'+m.group(2)+' ds-visual-review"',
            html, count=1, flags=re.I
        )
    else:
        html=re.sub(
            r'<body([^>]*)class="([^"]*)"',
            lambda m: '<body'+m.group(1)+'class="'+m.group(2)+' ds-auth-os-page ds-auth-os-shell-active ds-visual-review"',
            html, count=1, flags=re.I
        )

    # Reveal real application markup without running authentication.
    html=re.sub(
        r'(id="(?:feedApp|communityApp|dmApp|notificationApp|directoryApp|agentJourneyApp|agentLearningApp|appointmentApp|profileApp|settingsApp)"[^>]*class=")([^"]*)"',
        lambda m:m.group(1)+re.sub(r'\bmember-hidden\b','',m.group(2)).strip()+'"',
        html
    )

    # Inject the preview-only safety/visibility stylesheet.
    if 'dominionstar-visual-review.css' not in html:
        html=html.replace('</head>','<link rel="stylesheet" href="/assets/css/dominionstar-visual-review.css?v=9"><script defer src="/assets/js/dominionstar-visual-review-fixtures.js?v=9"></script></head>',1)

    p.write_text(html,encoding='utf-8')

hub='''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>DominionStar Visual Review</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 75% 0,#123a68 0,transparent 28%),linear-gradient(145deg,#041020,#061225 42%,#0a1c36);color:#f5f8fc;font-family:Inter,system-ui,sans-serif}
main{width:min(1120px,calc(100% - 32px));margin:0 auto;padding:48px 0 64px}.eyebrow{color:#f0c15b;text-transform:uppercase;letter-spacing:.18em;font-size:11px;font-weight:900}
h1{font:700 clamp(34px,5vw,58px)/1.02 Georgia,serif;margin:10px 0 12px}p{color:#b7c6d9;line-height:1.6}.notice{padding:14px 16px;border:1px solid rgba(53,208,127,.3);background:rgba(53,208,127,.07);border-radius:14px;margin:22px 0}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:24px}.card{display:block;padding:18px;border:1px solid rgba(126,168,221,.2);border-radius:16px;background:linear-gradient(155deg,rgba(20,42,75,.94),rgba(9,25,49,.94));color:#f5f8fc;text-decoration:none;box-shadow:0 16px 36px rgba(0,0,0,.2)}
.card:hover{border-color:rgba(24,119,242,.55);transform:translateY(-1px)}.card strong{display:block;margin-bottom:5px}.card span{font-size:12px;color:#9eb2c9}@media(max-width:800px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.grid{grid-template-columns:1fr}}
</style></head><body><main><p class="eyebrow">DominionStar Executive OS</p><h1>Visual review hub</h1>
<p>Review the real static Agent OS layouts below. Production authentication, Supabase, realtime, calls, uploads, and serverless actions are disabled in this preview.</p>
<div class="notice"><strong>Design review only.</strong> Use this build to inspect proportions, spacing, colors, cards, typography, sidebar density, and page composition.</div>
<div class="grid">
<a class="card" href="/member-dashboard/"><strong>Dashboard</strong><span>Approved illustration composition</span></a>
<a class="card" href="/feed/"><strong>Feed</strong><span>Social stream and composer</span></a>
<a class="card" href="/direct-messages/"><strong>Messages</strong><span>Three-column inbox</span></a>
<a class="card" href="/notifications/"><strong>Notifications</strong><span>Executive inbox</span></a>
<a class="card" href="/community/"><strong>Community</strong><span>Composer, feed and standards</span></a>
<a class="card" href="/member-directory/"><strong>Team Members</strong><span>Compact member directory</span></a>
<a class="card" href="/agent-journey/"><strong>My Journey</strong><span>Progress and milestones</span></a>
<a class="card" href="/agent-learning/"><strong>Learning</strong><span>Training and development</span></a>
<a class="card" href="/appointments/"><strong>Calendar</strong><span>Appointments and status</span></a>
<a class="card" href="/professional-profile/"><strong>My Profile</strong><span>Identity and professional record</span></a>
<a class="card" href="/account-settings/"><strong>Agent Settings</strong><span>Compact settings workspace</span></a>
</div></main></body></html>'''
(dist/'index.html').write_text(hub,encoding='utf-8')
PY

  cat > "$DIST/_headers" <<'HEADERS'
/*
  X-Robots-Tag: noindex, nofollow, noarchive
  Cache-Control: no-store
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
HEADERS

  cat > "$DIST/robots.txt" <<'ROBOTS'
User-agent: *
Disallow: /
ROBOTS

  # Netlify packages functions after the build command. Remove them so this
  # review package cannot expose production-backed serverless endpoints.
  if [[ "${NETLIFY:-}" == "true" && -d "$ROOT/netlify/functions" ]]; then
    find "$ROOT/netlify/functions" -type f -delete
  fi

  echo "DOMINIONSTAR_DEPLOY_PREVIEW_STATIC_VISUAL_OK"
  exit 0
fi

# Branch deploys and non-main Netlify builds remain hard-blocked unless a
# separately approved staging site and staging Supabase project are configured.
if [[ "${CONTEXT:-}" == "branch-deploy" ||
      ( -n "${BRANCH:-}" && "${BRANCH}" != "main" &&
        ( "${NETLIFY:-}" == "true" || "${CONTEXT:-}" == "production" ) ) ||
      ( -n "${DOMINIONSTAR_STAGING_NETLIFY_SITE_ID:-}" &&
        "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" != "STAGING_ONLY" ) ]]; then
  if [[ "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" != "STAGING_ONLY" ]]; then
    echo "ERROR: non-production deploy blocked until isolated Netlify/Supabase staging is configured." >&2
    exit 47
  fi
fi

# Production domain boundary:
# - The public DominionStar website owns `/`.
# - Browser Meet is published only at `/meet/`.
# - Desktop Meet source must never become the production homepage.
required_paths=(
  "index.html"
  "styles.css"
  "_headers"
  "_redirects"
  "financial-services/index.html"
  "opportunity/index.html"
  "institute/index.html"
  "academy/index.html"
  "member-login/index.html"
  "about/index.html"
  "mentorship/index.html"
  "assets/css/dominionstar-public-v5.css"
  "assets/js/dominionstar-public-v5.js"
  "assets/js/dominionstar-geography.js"
  "scripts/test-public-geography.mjs"
  "scripts/test-aurora-executive.mjs"
  "netlify/functions/aurora-chat.mjs"
  "assets/ds-public-hero.jpg"
  "assets/ds-public-founder.jpg"
  "join/index.html"
  "schedule/index.html"
  "consultation/index.html"
  "thank-you.html"
  "events/index.html"
  "knowledge/index.html"
  "mentorship/getting-started/index.html"
  "mentorship/professional-growth/index.html"
  "mentorship/leadership/index.html"
  "opportunity/licensing/index.html"
  "opportunity/first-90-days/index.html"
  "opportunity/business-building/index.html"
  "financial-services/long-term-care/index.html"
  "financial-services/annuities/index.html"
  "financial-services/living-trusts/index.html"
  "assets/js/dominionstar-protection-tools.js"
  "financial-services/life-insurance/index.html"
  "financial-services/learning-lab/index.html"
  "financial-services/probate-estate/index.html"
  "financial-services/term-life/index.html"
  "financial-services/whole-life/index.html"
  "financial-services/universal-life/index.html"
  "financial-services/indexed-universal-life/index.html"
  "assets/js/dominionstar-life-interactive.js"
  "assets/js/dominionstar-index-lab.js"
  "public-release.json"
  "opportunity/canada/index.html"
  "assets/js/dominionstar-financial-lab.js"
  "meet-desktop/ui/index.html"
)

for rel in "${required_paths[@]}"; do
  if [ ! -s "$ROOT/$rel" ]; then
    echo "ERROR: refusing public deploy; missing required file: $rel" >&2
    exit 41
  fi
done

# Review-only Aurora JS syntax + capability/UX safety contract.
node --check "$ROOT/assets/js/dominionstar-public-v5.js"
node "$ROOT/scripts/test-aurora-executive.mjs"
node "$ROOT/scripts/test-public-geography.mjs"

rm -rf "$DIST"
mkdir -p "$DIST"

# Build the public website first. Desktop source is explicitly excluded.
rsync -a "$ROOT/" "$DIST/" \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'tests/' \
  --exclude 'netlify.toml' \
  --exclude 'public-dist/' \
  --exclude 'rebuild-dist/' \
  --exclude 'meet-desktop/' \
  --exclude 'desktop/' \
  --exclude 'desktop 2/' \
  --exclude 'scripts/' \
  --exclude 'supabase/' \
  --exclude 'netlify/' \
  --exclude 'node_modules/' \
  --exclude '*.md' \
  --exclude '*.zip'

# Browser Meet is an isolated route, never the public root.
rm -rf "$MEET_DIST"
mkdir -p "$MEET_DIST"
rsync -a --delete "$MEET_SOURCE/" "$MEET_DIST/"

# The public homepage must be the public DominionStar site, never Meet.
grep -Fq 'Home — No Family Left Behind | DominionStar Leadership Development' "$DIST/index.html"
# Static release identifier helps distinguish a published Netlify deploy from stale hosting.
grep -Fq 'V10-quality-gate-2026-10-17' "$DIST/index.html"
grep -Fq '"release": "V10-quality-gate-2026-10-17"' "$DIST/public-release.json"
grep -Fq 'href="/mentorship/"' "$DIST/index.html"
grep -Fq 'href="/about/"' "$DIST/index.html"
grep -Fq 'Aurora' "$DIST/index.html"
grep -Fq 'aurora-v8-panel' "$ROOT/assets/css/dominionstar-public-v5.css"
grep -Fq 'aurora-executive-panel' "$ROOT/assets/css/dominionstar-public-v5.css"
grep -Fq 'aurora-executive-quick-grid' "$DIST/assets/js/dominionstar-public-v5.js"
grep -Fq 'aurora-v8-transcript' "$ROOT/assets/js/dominionstar-public-v5.js"
grep -Fq 'AURORA_AI_ENABLED' "$ROOT/netlify/functions/aurora-chat.mjs"
grep -Fq 'Speak to Aurora' "$ROOT/assets/js/dominionstar-public-v5.js"
grep -Fq 'href="/opportunity/canada/"' "$DIST/opportunity/index.html"
grep -Fq 'href="/financial-services/probate-estate/"' "$DIST/financial-services/index.html"
grep -Fq 'href="/financial-services/living-trusts/"' "$DIST/financial-services/index.html"
grep -Fq 'https://dominionstarld.com/financial-services/living-trusts/' "$DIST/sitemap.xml"
grep -Fq 'Aretha Franklin' "$DIST/financial-services/probate-estate/index.html"
grep -Fq 'Canada recruiting priority' "$DIST/opportunity/canada/index.html"
# No undefined links or placeholders in product education.
for rel in financial-services/life-insurance/index.html financial-services/long-term-care/index.html; do
  if grep -Eq 'href="undefined"|>undefined<' "$DIST/$rel"; then
    echo "ERROR: broken financial education card in $rel" >&2
    exit 42
  fi
done
for rel in financial-services/term-life/index.html financial-services/whole-life/index.html financial-services/universal-life/index.html financial-services/indexed-universal-life/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$rel"
  grep -Fq 'class="aurora-trigger"' "$DIST/$rel"
  grep -Fq 'dominionstarwfg@gmail.com' "$DIST/$rel"
done
grep -Fq 'data-term-demo' "$DIST/financial-services/term-life/index.html"
grep -Fq 'dominionstar-life-interactive.js' "$DIST/financial-services/term-life/index.html"
grep -Fq 'data-event-output' "$DIST/financial-services/term-life/index.html"
grep -Fq 'data-index-svg' "$DIST/financial-services/indexed-universal-life/index.html"
grep -Fq 'dominionstar-index-lab.js' "$DIST/financial-services/indexed-universal-life/index.html"
grep -Fq 'data-index-svg' "$DIST/financial-services/universal-life/index.html"
grep -Fq 'AURORA_WEB_SEARCH_ENABLED' "$ROOT/netlify/functions/aurora-chat.mjs"
grep -Fq 'Search official sources' "$ROOT/assets/js/dominionstar-public-v5.js"
# Validate canonical social URLs for key consumer education pages.
for slug in life-insurance term-life whole-life universal-life indexed-universal-life long-term-care; do
  file="$DIST/financial-services/$slug/index.html"
  grep -Fq "<meta property=\"og:url\" content=\"https://dominionstarld.com/financial-services/$slug/\">" "$file"
  if grep -Fq 'href="undefined"' "$file"; then
    echo "ERROR: undefined link in $file" >&2
    exit 42
  fi
done


# LTC and annuity learning experiences must always have real pages and working interactive scripts.
for entry in financial-services/annuities/index.html financial-services/long-term-care/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$entry"
  grep -Fq 'class="aurora-trigger"' "$DIST/$entry"
  grep -Fq 'dominionstarwfg@gmail.com' "$DIST/$entry"
done
grep -Fq 'href="/financial-services/annuities/#annuity-calculator"' "$DIST/financial-services/life-insurance/index.html"
grep -Fq 'href="/financial-services/long-term-care/#ltc-gap-tool"' "$DIST/financial-services/life-insurance/index.html"
grep -Fq 'data-financial-tool="annuity"' "$DIST/financial-services/annuities/index.html"
grep -Fq 'data-financial-tool="ltc"' "$DIST/financial-services/long-term-care/index.html"
grep -Fq 'dominionstar-protection-tools.js' "$DIST/financial-services/annuities/index.html"
grep -Fq 'dominionstar-protection-tools.js' "$DIST/financial-services/long-term-care/index.html"
grep -Fq '<meta property="og:url" content="https://dominionstarld.com/financial-services/annuities/">' "$DIST/financial-services/annuities/index.html"
grep -Fq 'https://www.investor.gov/introduction-investing/investing-basics/investment-products/annuities' "$DIST/financial-services/annuities/index.html"
if grep -Eq 'href="undefined"|>undefined<' "$DIST/financial-services/annuities/index.html"; then
  echo "ERROR: annuity education contains undefined links or placeholders." >&2
  exit 44
fi

# Ensure all educational routes have correct social-sharing metadata and working in-page navigation.
for rel in \
  mentorship/getting-started/index.html mentorship/professional-growth/index.html mentorship/leadership/index.html \
  opportunity/licensing/index.html opportunity/first-90-days/index.html opportunity/business-building/index.html \
  financial-services/learning-lab/index.html; do
  path="${rel%index.html}"
  grep -Fq "<meta property=\"og:url\" content=\"https://dominionstarld.com/$path\">" "$DIST/$rel"
  if grep -Fq 'href="undefined"' "$DIST/$rel"; then
    echo "ERROR: invalid internal link in $rel" >&2
    exit 43
  fi
done
grep -Fq '<section class="section section-light" id="learn">' "$DIST/financial-services/learning-lab/index.html"
grep -Fq 'negative index change generally does not create a negative interest credit' "$DIST/financial-services/indexed-universal-life/index.html"
for route in /academy/ /platform/; do
  grep -Fq "$route " "$DIST/_redirects"
done
# The Journey page is a real published route, not a redirect to Opportunity.
test -s "$DIST/journey/index.html"
if grep -Eq '^/journey/ +/opportunity/ ' "$DIST/_redirects"; then
  echo "ERROR: Journey page would be shadowed by a stale redirect." >&2
  exit 46
fi
grep -Fq '/journey /journey/ 301!' "$DIST/_redirects"
# Reject legacy conversion-page templates when building the production website.
grep -Fq 'name="dominionstar-join"' "$DIST/join/index.html"
grep -Fq 'name="dominionstar-qualified-appointment"' "$DIST/schedule/index.html"
grep -Fq 'name="dominionstar-client-consultation"' "$DIST/consultation/index.html"
for rel in join/index.html schedule/index.html consultation/index.html; do
  if grep -Eiq 'Project Genesis RC5' "$DIST/$rel"; then
    echo "ERROR: legacy conversion page detected: $rel" >&2
    exit 45
  fi
done

# Region and appointment-time-zone quality gate: enforce form and educational UI contract.
for rel in schedule/index.html consultation/index.html; do
  grep -Fq 'data-ds-country' "$DIST/$rel"
  grep -Fq 'data-ds-region' "$DIST/$rel"
  grep -Fq 'data-ds-timezone' "$DIST/$rel"
  grep -Fq 'name="time-zone"' "$DIST/$rel"
  grep -Fq 'dominionstar-geography.js' "$DIST/$rel"
done
grep -Fq 'data-ds-region' "$DIST/join/index.html"
grep -Fq 'data-ds-geography' "$DIST/financial-services/index.html"
for rel in financial-services/life-insurance/index.html financial-services/long-term-care/index.html; do
  grep -Fq 'data-ds-geography' "$DIST/$rel"
  grep -Fq 'data-ds-regulator-link' "$DIST/$rel"
  grep -Fq 'dominionstar-geography.js' "$DIST/$rel"
done
grep -Fq 'dominionstar-geography.js' "$DIST/financial-services/index.html"
grep -Fq 'America/New_York' "$DIST/assets/js/dominionstar-geography.js"

# Source-of-truth lead capture: three static Netlify forms must retain campaign fields.
for rel in join/index.html schedule/index.html consultation/index.html; do
  grep -Fq 'data-netlify="true"' "$DIST/$rel"
  grep -Fq 'name="campaign_source"' "$DIST/$rel"
  grep -Fq 'name="campaign_medium"' "$DIST/$rel"
  grep -Fq 'name="campaign_name"' "$DIST/$rel"
  grep -Fq 'name="campaign_entry_path"' "$DIST/$rel"
done
grep -Fq 'generate_lead' "$DIST/assets/js/dominionstar-public-v5.js"
grep -Fq 'dominionstar_lead_pending_v1' "$DIST/assets/js/dominionstar-public-v5.js"
test -s "$DIST/thank-you.html"

# The existing member and desktop source are preserved; public auth still requires a separate access-control review.

# Educational journeys must be built as independent pages, not booking-form redirects.
for rel in mentorship/getting-started/index.html mentorship/professional-growth/index.html mentorship/leadership/index.html opportunity/licensing/index.html opportunity/first-90-days/index.html opportunity/business-building/index.html financial-services/life-insurance/index.html financial-services/long-term-care/index.html financial-services/learning-lab/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$rel"
  grep -Fq 'tel:+13462042641' "$DIST/$rel"
  grep -Fq 'mailto:dominionstarwfg@gmail.com' "$DIST/$rel"
done
# Public conversion routes must share the production design and form detection.
for rel in join/index.html schedule/index.html consultation/index.html events/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$rel"
  grep -Fq 'data-netlify="true"' "$DIST/$rel"
done
for rel in mentorship/index.html financial-services/index.html opportunity/index.html about/index.html knowledge/index.html; do
  grep -Fq 'class="site-header"' "$DIST/$rel"
done
if grep -Fq 'DominionStar Meet' "$DIST/index.html"; then
  echo "ERROR: Meet content reached the public homepage." >&2
  exit 42
fi

# Browser Meet must exist only at its dedicated route.
grep -Fq 'DominionStar Meet' "$MEET_DIST/index.html"
test ! -e "$DIST/meet-desktop"
test ! -e "$DIST/rebuild-dist"

# Block accidental activation of gated web Agent Dashboard features before
# publishing any Netlify output, including isolated review/staging packages.
node "$ROOT/scripts/check-agent-release-gates.mjs" "$DIST"

# npm manifests are build inputs, not public website assets. The release gate
# has already verified them; do not publish dependency metadata in public-dist.
rm -f "$DIST/package.json" "$DIST/package-lock.json"

echo "DOMINIONSTAR_PUBLIC_ROOT_OK"
echo "DOMINIONSTAR_BROWSER_MEET_ROUTE_OK /meet/"

# This rewrites ONLY the packaged browser clients, never the shared source.
# It validates actual Netlify site identity and separate Supabase credentials.
if [[ "${DOMINIONSTAR_STAGING_ISOLATION_APPROVED:-}" == "STAGING_ONLY" ]]; then
  node "$ROOT/scripts/prepare-isolated-staging.mjs"
  echo "DOMINIONSTAR_STAGING_BACKEND_ISOLATED_OK"
fi
