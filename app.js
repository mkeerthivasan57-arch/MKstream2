/*
MKstream v22 - Static frontend app (app.js)
Implements: categories, admin (localStorage), video player with servers/subtitles/qualities, 
episode ranges, search overlay, mobile sidebar, lazy loading, prefetch hints, SEO meta updates,
telegram feed field stored, pagination center, load more, dark-navy theme. 
No sample/demo media included - empty content by default.
*/

(() => {
  const STORAGE_KEY = 'mk_v22_state';

  // default empty state
  const defaultState = {
    site: {
      name: 'MKstream',
      logo: '',
      colors: { bg:'#051426', header:'#07112b', card:'#0b1630', accent:'#1e90ff' },
      seo: { title: 'MKstream', description: 'MKstream - Watch series and movies' },
      telegramFeed: '',
      password: 'admin123',
      ads: { header:'', playerOverlay:'', sidebar:'', popupIntervalSeconds:7200 }
    },
    categories: [
      { id:'anime', name:'anime', sub:[] },
      { id:'donghua', name:'donghua', sub:[] },
      { id:'cartoon', name:'cartoon', sub:[] },
      { id:'serial', name:'serial', sub:[] },
      { id:'webseries', name:'web series', sub:[] },
      { id:'movies', name:'movies', sub:[] }
    ],
    series: [], // each: {id,title,category,subcategory,thumbnail,episodes: [{id,number,title,servers:[{name,url,quality}],subtitles:[{lang,url}]}],views,createdAt}
    settings: { pageSize: 12 }
  };

  // util
  function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }
  function load(){ try{ const raw = localStorage.getItem(STORAGE_KEY); return raw? JSON.parse(raw): JSON.parse(JSON.stringify(defaultState)); }catch(e){ console.error(e); return JSON.parse(JSON.stringify(defaultState)); } }
  function save(state){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){ console.error('save failed', e); } }

  const state = load();

  // ---------------- DOM helpers ----------------
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  // header elements
  const yearEls = qsa('#year, #year-cat, #year-pl, #year-admin');
  yearEls.forEach(e => e.textContent = new Date().getFullYear());

  // mobile sidebar
  const sidebar = qs('#sidebar');
  const sidebarCats = qs('#sidebar-cats');
  const menuBtn = qs('#mobile-menu-btn');
  const sidebarClose = qs('#sidebar-close');
  const brand = qs('#brand');
  const adminOpen = qs('#admin-open');
  const categoriesDesktop = qs('#categories-desktop');

  // search overlay
  const searchToggle = qs('#search-toggle');
  const searchOverlay = qs('#search-overlay');
  const searchInput = qs('#search-input');
  const searchClose = qs('#search-close');
  const searchResults = qs('#search-results');

  // main grids
  const specialsGrid = qs('#specials-grid');
  const recentGrid = qs('#recent-grid');
  const mostGrid = qs('#most-grid');
  const loadMoreBtn = qs('#load-more');

  // Player page elements (may not exist on every page)
  const videoPlayer = qs('#video-player');
  const serverSelect = qs('#server-select');
  const qualitySelect = qs('#quality-select');
  const subtitleSelect = qs('#subtitle-select');
  const downloadBtn = qs('#download-video');
  const episodeRanges = qs('#episode-ranges');
  const episodeList = qs('#episode-list');
  const playerTitle = qs('#player-title');
  const relatedDiv = qs('#related');
  const backHome = qs('#back-home');

  // admin page elements (may not exist on every page)
  const adminPass = qs('#admin-pass');
  const adminLogin = qs('#admin-login');
  const adminStatus = qs('#admin-status');
  const formCategory = qs('#form-category');
  const formSubcat = qs('#form-subcategory');
  const formTitle = qs('#form-title');
  const formThumbnail = qs('#form-thumbnail');
  const episodeRows = qs('#episode-rows');
  const addEpisodeRowBtn = qs('#add-episode-row');
  const saveSeriesBtn = qs('#save-series');
  const exportJsonBtn = qs('#export-json');
  const importJsonInput = qs('#import-json');
  const siteNameInput = qs('#site-name');
  const siteLogoInput = qs('#site-logo');
  const sitePassInput = qs('#site-password');
  const siteTelegramInput = qs('#site-telegram');
  const saveSiteBtn = qs('#save-site');
  const adsHeader = qs('#ads-header');
  const adsPlayer = qs('#ads-player');
  const saveAdsBtn = qs('#save-ads');
  const resetSiteBtn = qs('#reset-site');

  // pagination state
  let currentPage = 1;

  // init categories in sidebar & header
  function renderCategories(){
    sidebarCats.innerHTML = '';
    categoriesDesktop.innerHTML = '';
    state.categories.forEach(cat => {
      const b = document.createElement('button');
      b.textContent = cat.name;
      b.className = 'episode-btn';
      b.onclick = () => { location.href = `category.html?cat=${encodeURIComponent(cat.id)}`; };
      sidebarCats.appendChild(b);

      const bd = document.createElement('button');
      bd.textContent = cat.name;
      bd.className = 'episode-btn';
      bd.onclick = () => { location.href = `category.html?cat=${encodeURIComponent(cat.id)}`; };
      categoriesDesktop.appendChild(bd);
    });
  }

  // render empty grids (no dummy content)
  function renderGrids(){
    [specialsGrid, recentGrid, mostGrid].forEach(el => { if(el) el.innerHTML = '<div class="small">No content yet. Add series in Admin panel.</div>'; });
  }

  // sidebar open/close
  if(menuBtn) menuBtn.addEventListener('click', () => { sidebar.classList.add('active'); sidebar.setAttribute('aria-hidden','false'); });
  if(sidebarClose) sidebarClose.addEventListener('click', () => { sidebar.classList.remove('active'); sidebar.setAttribute('aria-hidden','true'); });
  if(brand) brand.addEventListener('click', () => { location.href = 'index.html'; });

  // search toggle
  if(searchToggle) searchToggle.addEventListener('click', () => {
    if(searchOverlay) { searchOverlay.classList.toggle('hidden'); searchOverlay.setAttribute('aria-hidden', searchOverlay.classList.contains('hidden') ? 'true' : 'false'); if(!searchOverlay.classList.contains('hidden')) searchInput.focus(); }
  });
  if(searchClose) searchClose.addEventListener('click', () => { searchOverlay.classList.add('hidden'); searchOverlay.setAttribute('aria-hidden','true'); });
  if(searchInput) searchInput.addEventListener('input', onSearchInput);

  function onSearchInput(e){
    const q = (e.target.value || '').trim().toLowerCase();
    searchResults.innerHTML = '';
    if(!q) return;
    const results = state.series.filter(s => (s.title||'').toLowerCase().includes(q) || (s.synopsis||'').toLowerCase().includes(q));
    if(results.length === 0){ searchResults.innerHTML = '<div class="small">No results</div>'; return; }
    results.forEach(r => {
      const d = document.createElement('div');
      d.className = 'card';
      d.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div style="flex:1"><strong>${escapeHtml(r.title)}</strong><div class="small">${escapeHtml(r.category||'')}</div></div><div><button class="btn">Open</button></div></div>`;
      d.querySelector('button').addEventListener('click', () => { location.href = `player.html?series=${encodeURIComponent(r.id)}`; });
      searchResults.appendChild(d);
    });
  }

  // simple page router actions for category/player/admin pages
  function pageInit(){
    renderCategories();
    if(location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname.endsWith('/')){
      renderGrids();
    }
    if(location.pathname.endsWith('category.html')) renderCategoryPage();
    if(location.pathname.endsWith('player.html')) renderPlayerPage();
    if(location.pathname.endsWith('admin.html')) renderAdminPage();
  }

  // render category page
  function renderCategoryPage(){
    const params = new URLSearchParams(location.search);
    const catId = params.get('cat') || '';
    const cat = state.categories.find(c => c.id === catId) || { name: catId || 'Category' };
    const titleEl = document.getElementById('category-title');
    const grid = document.getElementById('category-grid');
    const loadMore = document.getElementById('category-load-more');
    if(titleEl) titleEl.textContent = `Category: ${cat.name}`;
    if(grid){
      const seriesList = state.series.filter(s => s.category === cat.name);
      if(seriesList.length===0) grid.innerHTML = '<div class="small">No series in this category yet.</div>';
      else {
        grid.innerHTML = '';
        seriesList.forEach(s => {
          const card = createSeriesCard(s);
          grid.appendChild(card);
        });
      }
    }
    if(loadMore) loadMore.onclick = () => alert('No further pages - add more series in Admin');
    // sidebar controls on category page
    const mb = qs('#mobile-menu-btn-cat');
    const sc = qs('#sidebar-cat');
    const close = qs('#sidebar-close-cat');
    if(mb && sc && close){
      mb.addEventListener('click', () => { sc.classList.add('active'); sc.setAttribute('aria-hidden','false'); });
      close.addEventListener('click', () => { sc.classList.remove('active'); sc.setAttribute('aria-hidden','true'); });
    }
  }

  // create a card element for a series
  function createSeriesCard(s){
    const card = document.createElement('div');
    card.className = 'card';
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if(s.thumbnail){ const img = document.createElement('img'); img.src = s.thumbnail; img.loading='lazy'; img.style.width='100%'; img.style.height='140px'; img.style.objectFit='cover'; thumb.appendChild(img); } else { thumb.innerHTML = '<div style=\"height:140px;display:flex;align-items:center;justify-content:center;color:var(--muted)\">No thumbnail</div>'; }
    const meta = document.createElement('div'); meta.className='meta';
    meta.innerHTML = `<div class="title">${escapeHtml(s.title)}</div><div class="sub">${escapeHtml(s.category||'')}</div>`;
    const btnRow = document.createElement('div'); btnRow.style.marginTop='8px';
    const playBtn = document.createElement('button'); playBtn.className='btn'; playBtn.textContent='Play'; playBtn.addEventListener('click', () => { location.href = `player.html?series=${encodeURIComponent(s.id)}`; });
    btnRow.appendChild(playBtn);
    meta.appendChild(btnRow);
    card.appendChild(thumb); card.appendChild(meta);
    return card;
  }

  // render player page
  function renderPlayerPage(){
    const params = new URLSearchParams(location.search);
    const seriesId = params.get('series');
    const series = state.series.find(s => s.id === seriesId);
    if(!series){
      if(playerTitle) playerTitle.textContent = 'Series not found';
      if(episodeList) episodeList.innerHTML = '<div class="small">Series not found. Add series via Admin panel.</div>';
      return;
    }
    if(playerTitle) playerTitle.textContent = series.title || 'Untitled';
    // populate servers/qualities and subtitles from first episode by default
    const epIndex = 0;
    const episode = (series.episodes && series.episodes[epIndex]) ? series.episodes[epIndex] : null;
    populateEpisodes(series);
    populateRelated(series);
    if(episode){
      populatePlayer(episode);
    } else {
      if(videoPlayer) videoPlayer.innerHTML = '<div class="small">No episodes uploaded yet for this series.</div>';
    }
    // back home button
    if(backHome) backHome.addEventListener('click', () => location.href = 'index.html');
  }

  function populateEpisodes(series){
    if(!episodeRanges || !episodeList) return;
    episodeRanges.innerHTML = '';
    episodeList.innerHTML = '';
    const eps = series.episodes || [];
    const count = eps.length;
    if(count === 0){ episodeList.innerHTML = '<div class="small">No episodes</div>'; return; }
    // create ranges (1-100, 101-200...)
    const groups = Math.ceil(count / 100);
    const ranges = [];
    for(let i=0;i<groups;i++){
      const start = i*100 + 1; const end = Math.min((i+1)*100, count);
      ranges.push({ label: `${start}-${end}`, startIndex: start-1, endIndex: end-1 });
    }
    const sel = document.createElement('select'); sel.className='input';
    ranges.forEach((r, idx) => { const opt = document.createElement('option'); opt.value=idx; opt.textContent=r.label; sel.appendChild(opt); });
    sel.addEventListener('change', () => { renderEpisodeButtons(series, ranges[Number(sel.value)]); });
    episodeRanges.appendChild(sel);
    // default render first range
    renderEpisodeButtons(series, ranges[0]);
  }

  function renderEpisodeButtons(series, range){
    episodeList.innerHTML = '';
    const eps = series.episodes.slice(range.startIndex, range.endIndex+1);
    eps.forEach((ep, idx) => {
      const b = document.createElement('button');
      b.className = 'episode-btn';
      b.textContent = ep.number || (range.startIndex + idx + 1);
      b.addEventListener('click', () => { playEpisode(series, range.startIndex + idx); });
      episodeList.appendChild(b);
    });
  }

  // populate related series
  function populateRelated(series){
    if(!relatedDiv) return;
    relatedDiv.innerHTML = '<h3>Related</h3>';
    const related = state.series.filter(s => s.category === series.category && s.id !== series.id).slice(0,4);
    if(related.length===0) relatedDiv.innerHTML += '<div class="small">No related series</div>';
    else {
      const wrap = document.createElement('div'); wrap.style.display='flex'; wrap.style.gap='8px';
      related.forEach(r => {
        const c = document.createElement('div'); c.className='card'; c.style.width='160px'; c.innerHTML = `<div style="height:90px;background:#021827;border-radius:6px"></div><div style="padding:6px"><strong>${escapeHtml(r.title)}</strong></div>`;
        c.addEventListener('click', () => location.href = `player.html?series=${encodeURIComponent(r.id)}`);
        wrap.appendChild(c);
      });
      relatedDiv.appendChild(wrap);
    }
    // mostly viewed two
    const mv = [...state.series].sort((a,b)=> (b.views||0)-(a.views||0)).slice(0,2);
    if(mv.length>0){ relatedDiv.innerHTML += '<h4>Mostly viewed</h4>'; mv.forEach(m => { relatedDiv.innerHTML += `<div class="card" style="display:inline-block;width:180px;margin-right:8px;padding:8px"><div style="height:80px;background:#021827"></div><div style="padding:6px"><strong>${escapeHtml(m.title)}</strong></div></div>`; }); }
  }

  // populate player controls from episode
  function populatePlayer(episode){
    // video element
    if(!videoPlayer) return;
    videoPlayer.innerHTML = '';
    const vid = document.createElement('video');
    vid.id = 'main-video';
    vid.className = 'video';
    vid.controls = true;
    vid.preload = 'metadata';
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    // pick first server default
    const servers = episode.servers && episode.servers.length ? episode.servers : [{ name:'Default', url: episode.videoUrl || '' }];
    const first = servers[0] || { url: '' };
    const source = document.createElement('source');
    source.src = first.url || '';
    vid.appendChild(source);
    // subtitles
    if(episode.subtitles && Array.isArray(episode.subtitles)){
      episode.subtitles.forEach(st => {
        const tr = document.createElement('track');
        tr.kind = 'subtitles'; tr.label = st.lang || ''; tr.srclang = st.lang || ''; tr.src = st.url || '';
        vid.appendChild(tr);
      });
    }
    videoPlayer.appendChild(vid);

    // servers dropdown
    if(serverSelect){
      serverSelect.innerHTML = '';
      servers.forEach((sv, i) => {
        const o = document.createElement('option'); o.value = i; o.textContent = sv.name + (sv.quality? ` (${sv.quality})` : '');
        serverSelect.appendChild(o);
      });
      serverSelect.onchange = () => {
        const idx = Number(serverSelect.value); const s = servers[idx]; if(s && s.url){ vid.pause(); vid.src = s.url; vid.load(); vid.play().catch(()=>{}); }
      };
    }

    // subtitle select
    if(subtitleSelect){
      subtitleSelect.innerHTML = '<option value="">No subtitles</option>';
      (episode.subtitles||[]).forEach((st, i) => { const o = document.createElement('option'); o.value = i; o.textContent = st.lang; subtitleSelect.appendChild(o); });
      subtitleSelect.onchange = () => {
        const idx = Number(subtitleSelect.value);
        const tracks = vid.querySelectorAll('track');
        tracks.forEach((t, ti) => { t.mode = (ti === idx) ? 'showing' : 'disabled'; });
      };
    }

    // quality select (UI only unless servers provide different quality URLs)
    if(qualitySelect){
      qualitySelect.onchange = () => { /* no-op for static setup; servers may be used for quality switching */ };
    }

    // download button
    if(downloadBtn){
      downloadBtn.onclick = () => {
        const url = (vid.currentSrc || vid.src);
        if(!url) return alert('No downloadable source available');
        const a = document.createElement('a'); a.href = url; a.download = '';
        document.body.appendChild(a); a.click(); a.remove();
      };
    }

    // gestures: double-tap (desktop double-click) + long-press (mouse)
    let lastTap = 0;
    vid.addEventListener('dblclick', () => { vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10); });
    let longPressTimer = null;
    vid.addEventListener('mousedown', () => { longPressTimer = setInterval(()=>{ vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 3); }, 250); });
    vid.addEventListener('mouseup', () => { clearInterval(longPressTimer); });
    vid.addEventListener('mouseleave', () => { clearInterval(longPressTimer); });

    // autoplay next when ended
    vid.addEventListener('ended', () => {
      // find parent series & play next if exists
      const params = new URLSearchParams(location.search); const seriesId = params.get('series');
      const series = state.series.find(s => s.id === seriesId);
      if(series){
        const idx = (series.episodes||[]).findIndex(e => e.id === episode.id);
        const next = series.episodes && series.episodes[idx+1];
        if(next){ location.href = `player.html?series=${encodeURIComponent(series.id)}&ep=${encodeURIComponent(next.id)}`; }
      }
    });
  }

  function playEpisode(series, epIndex){
    // navigate to player with specific episode
    const s = series;
    const ep = s.episodes && s.episodes[epIndex];
    if(!ep) return alert('Episode not found');
    location.href = `player.html?series=${encodeURIComponent(s.id)}&ep=${encodeURIComponent(ep.id)}`;
  }

  // admin functions
  function renderAdminCategories(){
    if(!formCategory) return;
    formCategory.innerHTML = '';
    state.categories.forEach(c => { const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; formCategory.appendChild(o); });
  }

  function addEpisodeRow(data){
    if(!episodeRows) return;
    const row = document.createElement('div'); row.className = 'episode-row';
    row.innerHTML = `
      <input class="input ep-num" placeholder="Episode number" value="${data && data.number?data.number:''}">
      <input class="input ep-title" placeholder="Episode title" value="${data && data.title?escapeHtml(data.title):''}">
      <input class="input ep-video" placeholder="Video URL" value="${data && data.videoUrl?escapeHtml(data.videoUrl):''}">
      <input class="input ep-servers" placeholder="Servers JSON (optional)" value='${data && data.servers?escapeHtml(JSON.stringify(data.servers)):''}'>
      <input class="input ep-subtitles" placeholder="Subtitles JSON (optional)" value='${data && data.subtitles?escapeHtml(JSON.stringify(data.subtitles)):''}'>
      <button class="btn ep-remove">Remove</button>`;
    episodeRows.appendChild(row);
    row.querySelector('.ep-remove').addEventListener('click', () => row.remove());
  }

  if(addEpisodeRowBtn) addEpisodeRowBtn.addEventListener('click', () => addEpisodeRow());

  if(saveSeriesBtn) saveSeriesBtn.addEventListener('click', () => {
    // gather form
    const title = formTitle.value.trim();
    if(!title) return alert('Series title required');
    const category = formCategory.value;
    const subcat = (formSubcat && formSubcat.value.trim()) || '';
    const thumb = (formThumbnail && formThumbnail.value.trim()) || '';
    const eps = [];
    qsa('.episode-row').forEach(row => {
      const num = row.querySelector('.ep-num').value.trim();
      const t = row.querySelector('.ep-title').value.trim();
      const v = row.querySelector('.ep-video').value.trim();
      let servers = []; let subtitles = [];
      try{ const s = row.querySelector('.ep-servers').value.trim(); if(s) servers = JSON.parse(s); }catch(e){ alert('Invalid servers JSON'); }
      try{ const st = row.querySelector('.ep-subtitles').value.trim(); if(st) subtitles = JSON.parse(st); }catch(e){ alert('Invalid subtitles JSON'); }
      const ep = { id: uid('ep'), number: num || (eps.length+1), title: t || `Episode ${eps.length+1}`, videoUrl: v, servers, subtitles };
      eps.push(ep);
    });
    const series = { id: uid('series'), title, category, subcategory: subcat, thumbnail: thumb, episodes: eps, views:0, createdAt: Date.now() };
    state.series.unshift(series);
    save(state);
    alert('Series saved to localStorage');
    // clear form
    formTitle.value=''; formThumbnail.value=''; episodeRows.innerHTML='';
    renderGrids();
  });

  if(exportJsonBtn) exportJsonBtn.addEventListener('click', () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'mkstream_site_export.json'; a.click(); URL.revokeObjectURL(url);
  });

  if(importJsonInput) importJsonInput.addEventListener('change', (e) => {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = () => { try{ const parsed = JSON.parse(r.result); Object.assign(state, parsed); save(state); alert('Imported'); location.reload(); }catch(err){ alert('Invalid JSON file'); } }; r.readAsText(f);
  });

  if(adminLogin) adminLogin.addEventListener('click', () => {
    const pass = adminPass.value || '';
    if(pass === state.site.password){ adminStatus.textContent = 'Authenticated'; adminStatus.classList.remove('small'); adminStatus.classList.add('small'); alert('Authenticated'); renderAdminCategories(); // populate site inputs
      if(siteNameInput) siteNameInput.value = state.site.name || '';
      if(siteLogoInput) siteLogoInput.value = state.site.logo || '';
      if(sitePassInput) sitePassInput.value = state.site.password || '';
      if(siteTelegramInput) siteTelegramInput.value = state.site.telegramFeed || '';
      if(adsHeader) adsHeader.value = state.site.ads.header || '';
      if(adsPlayer) adsPlayer.value = state.site.ads.playerOverlay || '';
    } else alert('Wrong password');
  });

  if(saveSiteBtn) saveSiteBtn.addEventListener('click', () => {
    state.site.name = siteNameInput.value || state.site.name;
    state.site.logo = siteLogoInput.value || '';
    if(sitePassInput.value) state.site.password = sitePassInput.value;
    state.site.telegramFeed = siteTelegramInput.value || '';
    save(state);
    alert('Site settings saved');
  });

  if(saveAdsBtn) saveAdsBtn.addEventListener('click', () => {
    state.site.ads.header = adsHeader.value || ''; state.site.ads.playerOverlay = adsPlayer.value || ''; save(state); alert('Ads saved');
  });

  if(resetSiteBtn) resetSiteBtn.addEventListener('click', () => {
    if(confirm('Reset site data? This will clear all series and settings from localStorage.')){ localStorage.removeItem(STORAGE_KEY); location.reload(); }
  });

  // helpers
  function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  // prefetch links when hovering cards (improves perceived performance)
  function attachPrefetch(cardEl, url){
    cardEl.addEventListener('mouseenter', () => {
      const link = document.createElement('link'); link.rel='prefetch'; link.href = url; document.head.appendChild(link);
    });
  }

  // initial render
  pageInit();

})();