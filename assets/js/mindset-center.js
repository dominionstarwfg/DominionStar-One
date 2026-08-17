
(async () => {
  const gate = document.getElementById('mindsetGate');
  const app = document.getElementById('mindsetApp');
  const grid = document.getElementById('mindsetGrid');
  const filter = document.getElementById('mindsetTypeFilter');
  let allContent = [];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  if (!window.DSAuth.ready) {
    gate.innerHTML = '<p class="eyebrow">Unavailable</p><h1>Authentication service is temporarily unavailable.</h1>';
    return;
  }

  const supabase = await window.DSAuth.init();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/member-login/';
    return;
  }

  const { data: profile } = await supabase
    .from('member_profiles')
    .select('verification_status,rank')
    .eq('id', session.user.id)
    .single();

  if (profile?.verification_status !== 'approved') {
    gate.innerHTML = '<p class="eyebrow">Restricted</p><h1>Founder approval is required.</h1><p>This content is available to approved members.</p>';
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  async function loadContent() {
    grid.innerHTML = '<p>Loading content…</p>';

    const { data, error } = await supabase
      .from('mindset_content')
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      grid.innerHTML = `<p>${esc(error.message)}</p>`;
      return;
    }

    allContent = [];

    for (const item of (data || [])) {
      const { data: signed, error: signedError } = await supabase.storage
        .from('mindset-media')
        .createSignedUrl(item.storage_path, 3600);

      if (!signedError && signed?.signedUrl) {
        allContent.push({ ...item, signedUrl: signed.signedUrl });
      } else {
        console.warn('Could not create signed URL for mindset content:', {
          item,
          error: signedError
        });
        allContent.push({ ...item, signedUrl: null, mediaError: signedError?.message || 'Media unavailable' });
      }
    }

    render();
  }

  function render() {
    const type = filter.value;
    const visible = allContent.filter(item => !type || item.media_type === type);

    grid.innerHTML = visible.length ? visible.map(item => `
      <article class="mindset-content-card ${item.is_featured ? 'featured' : ''}">
        <div class="mindset-media-frame">
          ${item.signedUrl
            ? (item.media_type === 'video'
              ? `<video controls preload="metadata" src="${item.signedUrl}"></video>`
              : `<img src="${item.signedUrl}" alt="${esc(item.title)}">`)
            : `<div class="mindset-media-error">Media unavailable. ${esc(item.mediaError || '')}</div>`
          }
        </div>
        <div class="mindset-content-copy">
          <small>${item.is_featured ? 'Featured • ' : ''}${new Date(item.created_at).toLocaleDateString()}</small>
          <h2>${esc(item.title)}</h2>
          <p>${esc(item.description || '')}</p>
          ${item.target_rank ? `<span class="founding-member-badge">${esc(item.target_rank)} Focus</span>` : ''}
        </div>
      </article>
    `).join('') : `
      <div class="member-empty-state">
        <h2>No mindset content has been published yet.</h2>
        <p>The Founder can upload original DominionStar videos and images from Founder Admin.</p>
      </div>
    `;
  }

  filter.addEventListener('change', render);
  await loadContent();
})();
