(() => {
  const cards = [...document.querySelectorAll('.item-card')];
  const search = document.getElementById('driveSearch');
  const empty = document.getElementById('emptyState');
  const menu = document.getElementById('newMenu');
  const upload = document.getElementById('uploadInput');

  const detail = {
    name: document.getElementById('detailName'),
    subtitle: document.getElementById('detailSubtitle'),
    type: document.getElementById('detailType'),
    size: document.getElementById('detailSize'),
    modified: document.getElementById('detailModified'),
    owner: document.getElementById('detailOwner'),
    location: document.getElementById('detailLocation')
  };

  function selectCard(card) {
    cards.forEach(item => item.classList.toggle('selected', item === card));
    detail.name.textContent = card.dataset.name;
    detail.subtitle.textContent = card.dataset.type === 'Folder' ? `${card.dataset.type} · ${card.querySelector('p').textContent}` : card.dataset.type;
    detail.type.textContent = card.dataset.type;
    detail.size.textContent = card.dataset.size;
    detail.modified.textContent = card.dataset.modified;
    detail.owner.textContent = card.dataset.owner;
    detail.location.textContent = card.dataset.location;
  }

  cards.forEach(card => {
    card.addEventListener('click', () => selectCard(card));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCard(card); }
    });
  });

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let count = 0;
    cards.forEach(card => {
      const visible = card.dataset.name.toLowerCase().includes(query) || card.dataset.type.toLowerCase().includes(query);
      card.hidden = !visible;
      if (visible) count++;
    });
    empty.hidden = count !== 0;
  });

  document.getElementById('newButton').addEventListener('click', event => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#newMenu') && !event.target.closest('#newButton')) menu.hidden = true;
  });
  menu.addEventListener('click', event => {
    if (event.target.dataset.create === 'file') upload.click();
    if (event.target.dataset.create === 'folder') {
      const name = prompt('Folder name');
      if (name?.trim()) alert(`Folder “${name.trim()}” created in this prototype.`);
    }
    menu.hidden = true;
  });
  upload.addEventListener('change', () => {
    const count = upload.files.length;
    if (count) alert(`${count} file${count === 1 ? '' : 's'} selected for upload.`);
  });

  document.getElementById('shareButton').addEventListener('click', () => {
    const status = document.getElementById('shareStatus');
    status.textContent = `${detail.name.textContent} is ready to share.`;
    setTimeout(() => status.textContent = '', 2600);
  });

  document.querySelectorAll('.tabs button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(tab => tab.classList.remove('active'));
    button.classList.add('active');
  }));

  const params = new URLSearchParams(location.search);
  if (params.get('action') === 'upload') setTimeout(() => upload.click(), 200);
})();
