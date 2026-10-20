/* DominionStar Executive OS 2030 — authenticated, approved-member social actions.
 * Review branch only. Existing RPCs/table policies remain the security authority.
 */
(() => {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
  // Linkify only HTTP(S); keep all user-entered text escaped.
  const linkify = value => String(value ?? '').split(/(https?:\/\/[^\s<>"']+)/gi).map(part => {
    if (!/^https?:\/\//i.test(part)) return escapeHtml(part);
    const trailing=(part.match(/[).,!?;:]+$/)||[])[0]||'';
    const candidate=part.slice(0,part.length-trailing.length);
    try {
      const url=new URL(candidate);
      if (!['http:','https:'].includes(url.protocol)) return escapeHtml(part);
      return '<a href="'+escapeHtml(url.href)+'" target="_blank" rel="noopener noreferrer nofollow">'+escapeHtml(candidate)+'</a>'+escapeHtml(trailing);
    } catch { return escapeHtml(part); }
  }).join('');

  const icons = {
    like:'<path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8a3 3 0 0 1 2 3v4h6a2 2 0 0 1 2 2l-2 8a3 3 0 0 1-3 2H7"/>',
    comment:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8Z"/>',
    repost:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3"/>',
    share:'<path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M4 13v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  const icon = name => '<svg class="ds30-action-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
  const displayDate = value => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? '' : parsed.toLocaleDateString();
  };
  const asPosts = result => Array.isArray(result) ? result : [];
  const readableCount = (count, known) => known ? String(count) : '—';

  async function mount({client, memberId, target}) {
    if (!client || !memberId || !target) throw new Error('The member feed requires a verified session.');
    if (target.__ds30Controller) {
      await target.__ds30Controller.refresh();
      return;
    }
    let posts = [];
    let busy = false;
    let revision = 0;
    const status = document.createElement('p');
    status.className = 'ds30-social-status';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    target.insertAdjacentElement('afterend',status);
    const notice = (message, isError = false) => {
      status.textContent = message;
      status.classList.toggle('ds30-social-error',Boolean(isError));
    };
    const linkFor = id => new URL('/community/?post='+encodeURIComponent(id),location.origin).href;
    const findPost = id => posts.find(post => String(post.id) === String(id));
    const copy = async value => {
      if (!navigator.clipboard?.writeText) throw new Error('Copy requires a secure browser connection.');
      await navigator.clipboard.writeText(value);
    };
    const render = (counts) => {
      target.innerHTML = posts.map(post => {
        const author=post.author_preferred_name||post.author_full_name||'DominionStar Member';
        const founding=post.author_exclusive_number>=1&&post.author_exclusive_number<=20
          ? ' · Founding #'+post.author_exclusive_number : '';
        const description=String(post.body||post.description||'');
        const text=description.length>360 ? description.slice(0,360)+'…' : description;
        const stats=counts.get(String(post.id))||{};
        const likeCount=readableCount(stats.likes||0,stats.reactionsKnown);
        const commentCount=readableCount(stats.comments||0,stats.commentsKnown);
        const initials=author.trim().split(/\s+/).map(word=>word[0]).slice(0,2).join('').toUpperCase();
        const isLiked=Boolean(stats.viewerLiked);
        return `
        <article class="ds30-social-post" data-post-id="${escapeHtml(post.id)}">
          <header class="ds30-post-authorbar">
            <span class="ds30-author-avatar" aria-hidden="true">${escapeHtml(initials||'DS')}</span>
            <div class="ds30-post-author">
              <strong>${escapeHtml(author)}${escapeHtml(founding)}</strong>
              <small>${escapeHtml(displayDate(post.created_at))} <span aria-hidden="true">·</span> ${escapeHtml(post.post_type||'Update')}</small>
            </div>
            <div class="ds30-post-options">
              <button class="ds30-more-button" type="button" data-social="menu" aria-label="More post options" aria-expanded="false">${icon('more')}</button>
              <div class="ds30-post-menu" hidden>
                <button type="button" data-social="copy">Copy post text</button>
                <button type="button" data-social="link">Copy post link</button>
              </div>
            </div>
          </header>
          ${post.title ? '<h3>'+escapeHtml(post.title)+'</h3>' : ''}
          <p class="ds30-post-copy">${linkify(text)}</p>
          ${description.length>360?'<a class="ds30-view-full" href="'+escapeHtml(linkFor(post.id))+'">Read full post →</a>':''}
          <div class="ds30-post-engagement" aria-label="Post engagement">
            <span>${likeCount} ${stats.likes===1?'like':'likes'}</span>
            <span>${commentCount} ${stats.comments===1?'comment':'comments'}</span>
          </div>
          <div class="ds30-post-actions" role="group" aria-label="Post actions">
            <button type="button" class="${isLiked?'is-liked':''}" data-social="like" aria-pressed="${isLiked}">${icon('like')}<span>Like</span></button>
            <button type="button" data-social="comment" aria-expanded="false">${icon('comment')}<span>Comment</span></button>
            <button type="button" data-social="repost" title="Share the original post to your professional network">${icon('repost')}<span>Repost</span></button>
            <button type="button" data-social="share">${icon('share')}<span>Share</span></button>
          </div>
          <form class="ds30-comment-form" hidden>
            <label for="ds30-comment-${escapeHtml(post.id)}">Your comment</label>
            <div class="ds30-comment-row">
              <textarea id="ds30-comment-${escapeHtml(post.id)}" maxlength="1500" rows="2" required placeholder="Write a thoughtful comment…"></textarea>
              <button type="submit">Post</button>
            </div>
          </form>
        </article>`;
      }).join('') || '<div class="dashboard-empty-compact"><strong>No community posts yet.</strong><p>Be the first to share an update.</p><a href="/community/">Open Community →</a></div>';
    };
    const refresh = async () => {
      const current=++revision;
      const result=await client.rpc('list_community_feed',{result_limit:5});
      if(current!==revision)return;
      if(result.error)throw result.error;
      posts=asPosts(result.data).filter(p=>p && p.id);
      if(!posts.length){render(new Map());return;}
      const ids=posts.map(post=>post.id);
      const [reactionResult,commentResult]=await Promise.all([
        client.from('community_reactions').select('message_id,user_id,reaction').in('message_id',ids),
        client.from('community_comments').select('message_id').in('message_id',ids).eq('is_deleted',false)
      ]);
      if(current!==revision)return;
      const reactionOk=!reactionResult.error,commentOk=!commentResult.error;
      const counts=new Map(ids.map(id=>[String(id),{
        likes:0,comments:0,viewerLiked:false,reactionsKnown:reactionOk,commentsKnown:commentOk
      }]));
      if(reactionOk)(reactionResult.data||[]).forEach(reaction=>{
        const info=counts.get(String(reaction.message_id));
        if(!info||reaction.reaction!=='like')return;
        info.likes+=1;
        if(reaction.user_id===memberId)info.viewerLiked=true;
      });
      if(commentOk)(commentResult.data||[]).forEach(comment=>{
        const info=counts.get(String(comment.message_id));
        if(info)info.comments+=1;
      });
      render(counts);
      if(!reactionOk||!commentOk)notice('Some reaction totals are unavailable. You can still open the full conversation.');
    };
    const inFlight = async work => {
      if(busy)return;
      busy=true;
      target.setAttribute('aria-busy','true');
      try { await work(); }
      catch(error){ notice(error?.message||'The action could not be completed.',true); }
      finally{busy=false;target.removeAttribute('aria-busy');}
    };
    const closeMenus = () => {
      target.querySelectorAll('.ds30-post-menu').forEach(menu=>menu.hidden=true);
      target.querySelectorAll('[data-social="menu"]').forEach(button=>button.setAttribute('aria-expanded','false'));
    };
    target.addEventListener('click', event => {
      const button=event.target.closest('button[data-social]');
      if(!button||!target.contains(button))return;
      const card=button.closest('.ds30-social-post');
      const post=findPost(card?.dataset.postId);
      if(!post)return;
      const action=button.dataset.social;
      if(action==='menu'){
        const menu=card.querySelector('.ds30-post-menu'),willOpen=menu.hidden;
        closeMenus();menu.hidden=!willOpen;
        button.setAttribute('aria-expanded',String(willOpen));return;
      }
      closeMenus();
      if(action==='comment'){
        const form=card.querySelector('.ds30-comment-form');
        form.hidden=!form.hidden;
        button.setAttribute('aria-expanded',String(!form.hidden));
        if(!form.hidden)form.querySelector('textarea')?.focus();
        return;
      }
      if(action==='like')return void inFlight(async()=>{
        notice('Saving your reaction…');
        const result=await client.rpc('community_toggle_reaction',{
          target_message_id:post.id,target_reaction:'like'
        });
        if(result.error)throw result.error;
        await refresh();notice('Reaction updated.');
      });
      if(action==='copy')return void inFlight(async()=>{
        await copy([post.title,post.body||post.description].filter(Boolean).join('\n\n'));
        notice('Post text copied.');
      });
      if(action==='link')return void inFlight(async()=>{
        await copy(linkFor(post.id));notice('Post link copied.');
      });
      if(action==='share'){
        const url=linkFor(post.id);
        return void inFlight(async()=>{
          if(navigator.share)await navigator.share({title:post.title||'DominionStar post',url});
          else await copy(url);
          notice(navigator.share?'Share sheet opened.':'Post link copied.');
        });
      }
      if(action==='repost'){
        if(!window.confirm('Repost this professional update to the DominionStar community?'))return;
        return void inFlight(async()=>{
          const original=String(post.body||post.description||'').slice(0,1250);
          const author=post.author_preferred_name||post.author_full_name||'a DominionStar member';
          const message=('↻ Reposted from '+author+'\n\n'+original+'\n\nOriginal: '+linkFor(post.id)).slice(0,2000);
          const result=await client.from('community_messages').insert({
            user_id:memberId,
            title:('Reposted: '+String(post.title||'Community update')).slice(0,120),
            body:message,post_type:'discussion',is_pinned:false
          });
          if(result.error)throw result.error;
          await refresh();notice('Reposted to the community.');
        });
      }
    });
    target.addEventListener('submit',event=>{
      const form=event.target.closest('.ds30-comment-form');
      if(!form)return;
      event.preventDefault();
      const card=form.closest('.ds30-social-post');
      const post=findPost(card?.dataset.postId);
      const body=form.querySelector('textarea')?.value.trim();
      if(!post||!body)return;
      if(post.is_locked){notice('Comments are closed for this post.',true);return;}
      inFlight(async()=>{
        const result=await client.from('community_comments').insert({
          message_id:post.id,user_id:memberId,body:body.slice(0,1500)
        });
        if(result.error)throw result.error;
        // Noncritical mention alerts are handled separately by the Community workflow.
        await refresh();notice('Comment posted.');
      });
    });
    target.__ds30Controller={refresh};
    await refresh();
  }
  window.DSDashboardSocial={mount};
})();
