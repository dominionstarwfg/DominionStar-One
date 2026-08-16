(() => {
  const COPY_STATUS_ID = 'communityCopyStatus';
  const savedKey = 'dominionstar_saved_community_posts_v1';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  const normalizeUrl = raw => {
    const value = String(raw || '').trim();
    if (!value) return null;
    try {
      const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const parsed = new URL(candidate);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      return parsed.href;
    } catch {
      return null;
    }
  };

  const showStatus = message => {
    let status = document.getElementById(COPY_STATUS_ID);
    if (!status) {
      status = document.createElement('div');
      status.id = COPY_STATUS_ID;
      status.className = 'community-copy-toast';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.body.appendChild(status);
    }
    status.textContent = message;
    status.classList.add('show');
    clearTimeout(status._timer);
    status._timer = setTimeout(() => status.classList.remove('show'), 2200);
  };

  const writeClipboard = async text => {
    const value = String(text || '').trim();
    if (!value) return false;

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      textarea.remove();
      return success;
    }
  };

  const getSaved = () => {
    try {
      return JSON.parse(localStorage.getItem(savedKey) || '[]');
    } catch {
      return [];
    }
  };

  const setSaved = values => {
    localStorage.setItem(savedKey, JSON.stringify(values));
  };

  const detectMeetingId = text => {
    const match = String(text || '').match(/meeting\s*id\s*[:#-]?\s*([0-9][0-9\s-]{6,})/i);
    return match ? match[1].replace(/\D/g, '') : null;
  };

  const detectPasscode = text => {
    const match = String(text || '').match(/passcode\s*[:#-]?\s*([A-Za-z0-9_-]{2,})/i);
    return match ? match[1] : null;
  };

  const linkifyText = text => {
    const safe = escapeHtml(text);
    const urlPattern = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
    return safe.replace(urlPattern, match => {
      const normalized = normalizeUrl(match);
      if (!normalized) return match;
      const label = match.length > 72 ? `${match.slice(0, 69)}…` : match;
      return `<a class="community-auto-link" href="${escapeHtml(normalized)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    });
  };

  const renderRichBody = bodyEl => {
    if (!bodyEl || bodyEl.dataset.communityEnhanced === 'true') return;

    const rawText = bodyEl.innerText || bodyEl.textContent || '';
    bodyEl.dataset.communityRawText = rawText;
    bodyEl.dataset.communityEnhanced = 'true';

    const isLong = rawText.length > 460 || rawText.split('\n').length > 10;
    const collapsedText = isLong ? rawText.slice(0, 420).trimEnd() + '…' : rawText;

    bodyEl.innerHTML = linkifyText(collapsedText).replace(/\n/g, '<br>');

    if (isLong) {
      bodyEl.classList.add('community-collapsible');
      bodyEl.dataset.expanded = 'false';

      const readMore = document.createElement('button');
      readMore.type = 'button';
      readMore.className = 'community-inline-action';
      readMore.textContent = 'Read more';
      readMore.addEventListener('click', () => {
        const expanded = bodyEl.dataset.expanded === 'true';
        bodyEl.dataset.expanded = expanded ? 'false' : 'true';
        bodyEl.innerHTML = linkifyText(expanded ? collapsedText : rawText).replace(/\n/g, '<br>');
        readMore.textContent = expanded ? 'Read more' : 'Show less';
      });
      bodyEl.insertAdjacentElement('afterend', readMore);
    }
  };

  const buildActionBar = card => {
    if (card.querySelector('.community-utility-actions')) return;

    const bodyEl =
      card.querySelector('.community-post-body') ||
      card.querySelector('.community-message-body') ||
      card.querySelector('[data-community-body]') ||
      card.querySelector('p');

    if (!bodyEl) return;

    renderRichBody(bodyEl);

    const rawText = bodyEl.dataset.communityRawText || bodyEl.innerText || '';
    const urls = [...rawText.matchAll(/(?:https?:\/\/|www\.)[^\s]+/gi)].map(m => m[0]);
    const meetingId = detectMeetingId(rawText);
    const passcode = detectPasscode(rawText);

    const postId =
      card.dataset.postId ||
      card.getAttribute('data-id') ||
      card.id ||
      `community-${Math.abs([...rawText].reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0))}`;

    card.dataset.communityPostKey = postId;

    const actions = document.createElement('div');
    actions.className = 'community-utility-actions';
    actions.innerHTML = `
      <button type="button" class="community-utility-btn" data-community-copy-post>Copy post</button>
      ${urls.length ? '<button type="button" class="community-utility-btn" data-community-copy-link>Copy link</button>' : ''}
      ${meetingId ? '<button type="button" class="community-utility-btn" data-community-copy-meeting>Copy meeting ID</button>' : ''}
      ${passcode ? '<button type="button" class="community-utility-btn" data-community-copy-passcode>Copy passcode</button>' : ''}
      <button type="button" class="community-utility-btn" data-community-save-post>Save</button>
    `;

    const existingActions =
      card.querySelector('.community-post-actions') ||
      card.querySelector('.community-message-actions') ||
      card.querySelector('.reaction-row');

    if (existingActions) {
      existingActions.insertAdjacentElement('afterend', actions);
    } else {
      bodyEl.insertAdjacentElement('afterend', actions);
    }

    actions.querySelector('[data-community-copy-post]')?.addEventListener('click', async () => {
      const ok = await writeClipboard(rawText);
      showStatus(ok ? 'Post copied.' : 'Could not copy the post.');
    });

    actions.querySelector('[data-community-copy-link]')?.addEventListener('click', async () => {
      const ok = await writeClipboard(normalizeUrl(urls[0]) || urls[0]);
      showStatus(ok ? 'Link copied.' : 'Could not copy the link.');
    });

    actions.querySelector('[data-community-copy-meeting]')?.addEventListener('click', async () => {
      const ok = await writeClipboard(meetingId);
      showStatus(ok ? 'Meeting ID copied.' : 'Could not copy the meeting ID.');
    });

    actions.querySelector('[data-community-copy-passcode]')?.addEventListener('click', async () => {
      const ok = await writeClipboard(passcode);
      showStatus(ok ? 'Passcode copied.' : 'Could not copy the passcode.');
    });

    const saveButton = actions.querySelector('[data-community-save-post]');
    const refreshSaveState = () => {
      const saved = getSaved();
      const active = saved.includes(postId);
      saveButton.textContent = active ? 'Saved' : 'Save';
      saveButton.setAttribute('aria-pressed', active ? 'true' : 'false');
      saveButton.classList.toggle('is-saved', active);
    };
    refreshSaveState();

    saveButton?.addEventListener('click', () => {
      const saved = getSaved();
      const exists = saved.includes(postId);
      const next = exists ? saved.filter(id => id !== postId) : [...saved, postId];
      setSaved(next);
      refreshSaveState();
      showStatus(exists ? 'Removed from saved posts.' : 'Post saved.');
    });
  };

  const findCards = root => {
    const selectors = [
      '.community-post-card',
      '.community-message-card',
      '.community-feed-card',
      '.community-post',
      '[data-community-post]'
    ];
    return [...root.querySelectorAll(selectors.join(','))];
  };

  const enhance = root => {
    findCards(root).forEach(buildActionBar);
  };

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (
          node.matches?.('.community-post-card,.community-message-card,.community-feed-card,.community-post,[data-community-post]')
        ) {
          buildActionBar(node);
        }
        enhance(node);
      });
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    enhance(document);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
