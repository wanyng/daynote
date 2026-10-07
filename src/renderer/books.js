// Book covers stay inside the local backup, so moving or exporting data is self-contained.
let bookCoverDraft = '', coverRequest = 0;
function bookImage(cover, title, className = '') {
  return cover ? `<img class="${className}" src="${escapeHtml(cover)}" alt="${escapeHtml(title || '书籍封面')}">` : `<span class="cover-placeholder ${className}">${icon('book')}</span>`;
}
function renderCurrentCover() {
  const cover = state.book.cover || '';
  $('#current-cover-image').innerHTML = cover ? bookImage(cover, state.book.title) : '';
  $('#current-cover-image').hidden = !cover;
  $('.reading-card .book-cover').hidden = Boolean(cover);
  $('#finish-reading').disabled = !state.book.title;
}
function renderBookshelf() {
  const books = (state.finishedBooks || []).slice().sort((a, b) => b.finishedOn.localeCompare(a.finishedOn));
  $('#bookshelf-count').textContent = books.length + ' 本';
  $('#bookshelf-list').innerHTML = books.length ? books.map(book => `<button class="finished-book" data-edit-finished-book="${escapeHtml(book.id)}" aria-label="编辑已读书籍：${escapeHtml(book.title)}"><span class="finished-cover">${bookImage(book.cover, book.title)}</span><span class="finished-details"><strong>${escapeHtml(book.title)}</strong><span class="finished-author">${escapeHtml(book.author || '未填写作者')}</span><span class="finished-date">${escapeHtml(book.finishedOn.replaceAll('-', '.'))} 读完</span></span><span class="finished-edit">${icon('pen')}</span></button>`).join('') : `<div class="bookshelf-empty">${icon('book')}<p>读过的书，都留在这里。</p><span>从「当前阅读」标记读完，<br>或添加以前读完的书。</span></div>`;
}
function coverFields(cover) {
  bookCoverDraft = cover || ''; coverRequest++;
  return `<div class="cover-editor"><div class="cover-preview" id="cover-preview">${bookImage(bookCoverDraft, '封面预览')}</div><div class="cover-tools"><label class="cover-upload" tabindex="0">上传封面<input id="cover-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传书籍封面"></label><button type="button" class="text-button" id="remove-cover" ${bookCoverDraft ? '' : 'hidden'}>移除封面</button><p>支持 JPG、PNG、WebP，最大 8 MB。<br>图片仅保存在本地。</p><span id="cover-status" role="status"></span></div></div>`;
}
async function loadBookCover(file, input = $('#cover-file')) {
  const request = ++coverRequest;
  const status = $('#cover-status');
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    $$('#editor button[type=submit], #finish-current-book').forEach(button => button.disabled = false);
    status.textContent = '请选择 8 MB 以内的 JPG、PNG 或 WebP 图片。'; input.value = ''; return;
  }
  const buttons = [...$('#editor').querySelectorAll('button[type=submit], #finish-current-book')];
  buttons.forEach(button => button.disabled = true); status.textContent = '正在处理封面…';
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 24000000) throw new Error('图片尺寸过大，请选择 2400 万像素以内的图片。');
    const scale = Math.min(1, 400 / bitmap.width, 600 / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let cover = canvas.toDataURL('image/jpeg', .82);
    if (cover.length > 180000) cover = canvas.toDataURL('image/jpeg', .55);
    if (cover.length > 180000) throw new Error('图片处理后仍过大，请换一张尺寸更小的封面。');
    if (request !== coverRequest || !input.isConnected) return;
    bookCoverDraft = cover; $('#cover-preview').innerHTML = bookImage(cover, '封面预览'); $('#remove-cover').hidden = false;
    status.textContent = '封面已就绪，保存后生效。';
  } catch (error) {
    if (request === coverRequest && input.isConnected) status.textContent = error.message.startsWith('图片') ? error.message : '无法读取这张图片，请选择其他封面。';
  } finally {
    bitmap?.close();
    if (request === coverRequest && input.isConnected) { buttons.forEach(button => button.disabled = false); input.value = ''; }
  }
}
function editCurrentBook(finishing = false) {
  const book = state.book;
  openEditor(finishing ? '读完，加入书架' : '当前阅读',
    coverFields(book.cover) + field('书名', 'title', book.title, 'text', 'required maxlength="80"') + field('作者', 'author', book.author, 'text', 'maxlength="60"') + '<div class="field-row">' + field('已读页数', 'current', book.current, 'number', 'min="0" step="1" required') + field('总页数', 'total', book.total, 'number', 'min="1" step="1" required') + '</div><p class="field-error" id="book-error" hidden>已读页数不能大于总页数。</p>' + (finishing ? '<p class="dialog-note">保存后将按今天的日期收录到已读书架，并空出当前阅读的位置。</p>' : '<button type="button" class="finish-book-button" id="finish-current-book">读完，加入书架</button>'),
    (data, submitter) => {
      if (!data.title.trim()) return false;
      if (+data.current > +data.total) { $('#book-error').hidden = false; return false; }
      const updated = { title: data.title.trim(), author: data.author.trim(), total: +data.total, current: +data.current, cover: bookCoverDraft };
      if (finishing || submitter?.hasAttribute('data-finish-book')) {
        state.finishedBooks.push({ id: crypto.randomUUID(), title: updated.title, author: updated.author, total: updated.total, cover: updated.cover, finishedOn: dateKey(new Date()) });
        state.book = { title: '', author: '', current: 0, total: 1, cover: '' };
      } else state.book = updated;
    });
  if (finishing) $('#editor-form > .dialog-actions .primary-button').textContent = '加入已读书架';
}
function editFinishedBook(id) {
  const book = id ? state.finishedBooks.find(book => book.id === id) : { title: '', author: '', total: 1, finishedOn: dateKey(new Date()), cover: '' };
  if (!book) return;
  openEditor(id ? '编辑已读书籍' : '添加已读书籍', coverFields(book.cover) + field('书名', 'title', book.title, 'text', 'required maxlength="80"') + field('作者', 'author', book.author, 'text', 'maxlength="60"') + field('读完日期', 'finishedOn', book.finishedOn, 'date', 'required') + (id ? `<button type="button" class="danger-button" data-delete-finished-book="${escapeHtml(id)}">从书架删除</button>` : ''), data => {
    if (!data.title.trim()) return false;
    const current = id ? state.finishedBooks.find(book => book.id === id) : { id: crypto.randomUUID(), total: 1 };
    if (!current) { toast('这条已读记录已被删除'); return false; }
    Object.assign(current, { title: data.title.trim(), author: data.author.trim(), finishedOn: data.finishedOn, cover: bookCoverDraft });
    if (!id) state.finishedBooks.push(current);
  });
}
function initBooks() {
  $('#add-finished-book').onclick = () => editFinishedBook();
  $('#finish-reading').onclick = () => editCurrentBook(true);
  document.addEventListener('change', event => { if (event.target.id === 'cover-file') loadBookCover(event.target.files[0], event.target); });
  document.addEventListener('keydown', event => { if (event.target.matches('.cover-upload') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); $('#cover-file').click(); } });
  document.addEventListener('click', async event => {
    if (event.target.closest('#finish-current-book')) {
      const submit = $('#editor-form > .dialog-actions .primary-button');
      submit.dataset.finishBook = '';
      try { $('#editor-form').requestSubmit(submit); } finally { delete submit.dataset.finishBook; }
    }
    if (event.target.closest('#remove-cover')) {
      coverRequest++; bookCoverDraft = ''; $('#cover-preview').innerHTML = bookImage('', ''); $('#remove-cover').hidden = true; $('#cover-status').textContent = '保存后移除封面。';
      $$('#editor button[type=submit], #finish-current-book').forEach(button => button.disabled = false);
    }
    const edit = event.target.closest('[data-edit-finished-book]'); if (edit) editFinishedBook(edit.dataset.editFinishedBook);
    const remove = event.target.closest('[data-delete-finished-book]');
    if (remove) {
      const book = state.finishedBooks.find(book => book.id === remove.dataset.deleteFinishedBook); if (!book) return;
      const answer = window.daynote ? await window.daynote.confirmBookDelete(book.title) : { confirmed: window.confirm('删除这条已读记录？') };
      if (!answer.confirmed) return;
      const previous = structuredClone(state), previousRevision = revision;
      state.finishedBooks = state.finishedBooks.filter(b => b.id !== book.id);
      if (save()) { render(); closeEditor(); toast('已从书架删除'); }
      else { if (revision === previousRevision) state = previous; render(); }
    }
  });
}
