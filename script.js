const state = {
  data: [],
  filtered: [],
  imgType: localStorage.getItem('imgType') || 'icon',
  q: '',
  onlyFavs: JSON.parse(localStorage.getItem('onlyFavs')||'false'),
  favs: new Set(JSON.parse(localStorage.getItem('favs')||'[]'))
};

const els = {
  grid: document.getElementById('grid'),
  search: document.getElementById('search'),
  imgTypeRadios: Array.from(document.querySelectorAll('input[name="imgType"]')),
  favFilter: document.getElementById('favFilter'),
  btnOffline: document.getElementById('btnOffline'),
  netStatus: document.getElementById('netStatus'),
  detail: document.getElementById('detail'),
  detailImg: document.getElementById('detail-img'),
  detailTitle: document.getElementById('detail-title'),
  detailId: document.getElementById('detail-id'),
  detailGame: document.getElementById('detail-game'),
  detailVariants: document.getElementById('detail-variants'),
  devNotes: document.getElementById('dev-notes'),
  closeDetail: document.getElementById('closeDetail'),
  closeDetailInMedia: document.getElementById('closeDetailInMedia'),
  themeToggle: document.getElementById('themeToggle'),
  cardTpl: document.getElementById('card-tpl')
};

init();

async function init(){
  // theme
  const savedTheme = localStorage.getItem('theme');
  if(savedTheme){
    document.documentElement.classList.remove('theme-light','theme-dark');
    document.documentElement.classList.add(savedTheme);
  }
  // hydrate image type selection
  els.imgTypeRadios.forEach(r => {
    if (r.value === state.imgType) r.checked = true;
    r.addEventListener('change', () => {
      state.imgType = r.value; localStorage.setItem('imgType', state.imgType); renderGrid(); syncHashSelection();
    });
  });

  els.search.addEventListener('input', (e)=> { state.q = e.target.value.trim(); filter(); renderGrid(); });
  els.closeDetail.addEventListener('click', closeDetails);
  els.closeDetailInMedia.addEventListener('click', closeDetails);
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeDetails(); });
  window.addEventListener('hashchange', onHashChange);
  els.themeToggle.addEventListener('click', toggleTheme);

  // fav filter
  if(els.favFilter){
    els.favFilter.classList.toggle('active', state.onlyFavs);
    els.favFilter.addEventListener('click', ()=>{
      state.onlyFavs = !state.onlyFavs;
      localStorage.setItem('onlyFavs', JSON.stringify(state.onlyFavs));
      els.favFilter.classList.toggle('active', state.onlyFavs);
      filter(); renderGrid();
    });
  }

  // offline helpers
  if(els.btnOffline){ els.btnOffline.addEventListener('click', cacheVisibleForOffline); }
  updateNetStatus();
  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);
  registerSW();

  // load data
  try{
    state.data = await loadRoosterJSON('rooster.json');
  }catch(err){
    console.warn('Failed to fetch rooster.json. If opening from file://, use a local server.', err);
    // graceful fallback: attempt to read from embedded global if provided
    if (Array.isArray(window.ROOSTER_DATA)) {
      state.data = window.ROOSTER_DATA;
    } else {
      showEmpty('Could not load rooster.json');
      return;
    }
  }

  filter();
  renderGrid();
  onHashChange();
}

async function loadRoosterJSON(path){
  const res = await fetch(path, {cache:'no-store'});
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = await res.json();
  if(!Array.isArray(json)) throw new Error('Unexpected JSON shape: expected array');
  return json.map(normalizeItem);
}

function normalizeItem(item){
  const images = Array.isArray(item.images) ? item.images : [];
  const byType = Object.fromEntries(images.map(img => [img.type, img]));
  return {
    id: item.id,
    name: item.name || 'Untitled',
    videogameId: item.videogameId,
    imagesByType: byType,
    images
  };
}

function filter(){
  const q = state.q.toLowerCase();
  let arr = !q
    ? state.data.slice()
    : state.data.filter(x => x.name.toLowerCase().includes(q));
  if(state.onlyFavs){ arr = arr.filter(x => state.favs.has(x.id)); }
  // sort by name
  arr.sort((a,b)=> a.name.localeCompare(b.name));
  state.filtered = arr;
}

function renderGrid(){
  const list = state.filtered;
  const grid = els.grid;
  grid.innerHTML = '';
  grid.setAttribute('aria-busy', 'true');

  if(!list.length){ showEmpty('No matches'); return; }

  const frag = document.createDocumentFragment();
  for(const item of list){
    const card = els.cardTpl.content.firstElementChild.cloneNode(true);
    const imgEl = card.querySelector('img');
    const titleEl = card.querySelector('.title');
    const favBtn = card.querySelector('.fav');

    const url = pickImageURL(item, state.imgType) || pickImageURL(item, 'icon') || pickImageURL(item, 'stockIcon');
    if(url){ imgEl.src = url; imgEl.alt = item.name; }
    titleEl.textContent = item.name;

    // fav state
    const isFav = state.favs.has(item.id);
    if(favBtn){
      favBtn.classList.toggle('active', isFav);
      favBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleFav(item.id, favBtn); });
    }

    card.addEventListener('click', ()=> openDetails(item));
    card.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openDetails(item);} });
    card.dataset.id = item.id;
    frag.append(card);
  }
  grid.append(frag);
  grid.removeAttribute('aria-busy');
}

function pickImageURL(item, type){
  return item?.imagesByType?.[type]?.url || null;
}

function openDetails(item){
  els.detailTitle.textContent = item.name;
  els.detailId.textContent = String(item.id);
  els.detailGame.textContent = String(item.videogameId ?? '—');
  const url = pickImageURL(item, state.imgType) || pickImageURL(item, 'icon') || pickImageURL(item, 'stockIcon');
  els.detailImg.src = url || '';
  els.detailImg.alt = item.name;

  // variants
  els.detailVariants.innerHTML = '';
  // ensure a single fav button in meta
  const meta = els.detailVariants.parentElement;
  let favCtrl = meta.querySelector('button.fav');
  if(!favCtrl){
    favCtrl = document.createElement('button');
    favCtrl.className = 'fav';
    favCtrl.textContent = '★ Favorite';
    meta.insertBefore(favCtrl, els.detailVariants);
  }
  favCtrl.classList.toggle('active', state.favs.has(item.id));
  favCtrl.onclick = ()=> toggleFav(item.id, favCtrl);
  for(const img of item.images){
    const a = document.createElement('a');
    a.href = img.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.innerHTML = `<span style="opacity:.7">${img.type}</span>`;
    const badge = document.createElement('span');
    badge.textContent = `${img.width}×${img.height}`;
    badge.style.opacity = '.6';
    a.append(' ', badge);
    els.detailVariants.append(a);
  }

  renderDevNotesSimple(item);

  els.detail.classList.add('active');
  els.detail.setAttribute('aria-hidden','false');
  location.hash = `id-${item.id}`;
}

function closeDetails(){
  els.detail.classList.remove('active');
  els.detail.setAttribute('aria-hidden','true');
  if(location.hash.startsWith('#id-')){
    history.replaceState(null, '', location.pathname + location.search);
  }
}

function onHashChange(){
  const m = location.hash.match(/^#id-(\d+)/);
  if(!m) return;
  const id = Number(m[1]);
  const item = state.data.find(x=> x.id === id);
  if(item){ openDetails(item); }
}

function showEmpty(text){
  els.grid.innerHTML = `<div class="empty">${text}</div>`;
  els.grid.removeAttribute('aria-busy');
}

function toggleTheme(){
  const root = document.documentElement;
  const next = root.classList.contains('theme-light') ? 'theme-dark' : 'theme-light';
  root.classList.remove('theme-light','theme-dark');
  root.classList.add(next);
  localStorage.setItem('theme', next);
}

function toggleFav(id, btn){
  if(state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
  localStorage.setItem('favs', JSON.stringify(Array.from(state.favs)));
  if(btn) btn.classList.toggle('active', state.favs.has(id));
  // mirror card button if present
  const cardBtn = els.grid.querySelector(`.card[data-id="${id}"] .fav`);
  if(cardBtn && cardBtn !== btn) cardBtn.classList.toggle('active', state.favs.has(id));
  if(state.onlyFavs){ filter(); renderGrid(); }
}

function updateNetStatus(){
  const on = navigator.onLine;
  if(!els.netStatus) return;
  els.netStatus.classList.toggle('ok', on);
  els.netStatus.classList.toggle('off', !on);
  els.netStatus.title = on ? 'Online' : 'Offline';
}

async function cacheVisibleForOffline(){
  if(!('caches' in window)) return;
  const urls = new Set();
  urls.add(new URL('index.html', location.href).toString());
  urls.add(new URL('styles.css', location.href).toString());
  urls.add(new URL('script.js', location.href).toString());
  urls.add(new URL('rooster.json', location.href).toString());
  document.querySelectorAll('.card img[src]').forEach(img=> urls.add(img.src));

  const cacheName = 'app-dynamic-v1';
  const cache = await caches.open(cacheName);
  let ok = 0, fail = 0;
  await Promise.all(Array.from(urls).map(async (u)=>{
    try{ await cache.add(u); ok++; } catch{ fail++; }
  }));
  if(els.btnOffline){
    els.btnOffline.textContent = `Cached ${ok}${fail?` (+${fail} failed)`:''}`;
    setTimeout(()=> els.btnOffline.textContent = '⬇ Offline', 2000);
  }
}

async function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  try{ await navigator.serviceWorker.register('sw.js'); }catch(e){ console.warn('SW reg failed', e); }
}

function syncHashSelection(){
  if(location.hash.startsWith('#id-')) onHashChange();
}

function renderDevNotesSimple(item){
  const gql = `query Chars($id: ID!) {
  videogame(id:$id){
    id
    name
    characters{
      id
      name
      icon: images(type: "icon"){ id width height ratio type url }
      stock: images(type: "stockIcon"){ id width height ratio type url }
    }
  }
}`;

  els.devNotes.innerHTML = `
    <div class="code"><button class="copy" data-copy="gql">Copy</button><pre><code id="gql">${gql}</code></pre></div>
  `;
  const btn = els.devNotes.querySelector('.copy');
  if(btn){
    btn.addEventListener('click', ()=>{
      const code = els.devNotes.querySelector('#gql')?.innerText || '';
      navigator.clipboard?.writeText(code);
      const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(()=> btn.textContent = t, 1200);
    });
  }
}

function renderDevNotes(item){
  const vid = item.videogameId ?? 0;
  const gql = `query Chars($id: ID!){\n  videogame(id:$id){\n    id\n    name\n    characters{\n      id\n      name\n      icon: images(type: \"icon\"){ id width height ratio type url }\n      stock: images(type: \"stockIcon\"){ id width height ratio type url }\n    }\n  }\n}`;

  const curl1 = `# 1) Set your Start.GG API token\n# PowerShell (Windows)\n$env:STARTGG_TOKEN=\"YOUR_TOKEN\"\n# or bash (macOS/Linux)\nexport STARTGG_TOKEN=YOUR_TOKEN`;

  const curl2 = `# 2) Fetch characters for videogame ${vid} and save JSON\ncurl -s https://api.start.gg/gql/alpha \\\n  -H \"Authorization: Bearer $STARTGG_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  --data-binary @- > characters.json <<'JSON'\n{\n  \"query\": ${JSON.stringify(gql)},\n  \"variables\": { \"id\": ${vid} }\n}\nJSON`;

  const curl3 = `# 3) Convert to rooster.json (icon + stockIcon)\njq '[.data.videogame.characters[] | {id, name, videogameId: ${vid}, images: ((.icon + .stock) // [])}]' characters.json > rooster.json`;

  els.devNotes.innerHTML = `
    <h3>Dev Instructions — Automate graphics from start.gg</h3>
    <ol>
      <li>Create a Start.gg API token (account settings → Developer).</li>
      <li>Use the GraphQL query below with videogame ID <b>${vid}</b>.</li>
      <li>Run the cURL + jq snippets to generate rooster.json.</li>
    </ol>
    <div class="code"><button class="copy" data-copy="gql">Copy</button><pre><code id="gql">${gql}</code></pre></div>
    <div class="code"><button class="copy" data-copy="curl1">Copy</button><pre><code id="curl1">${curl1}</code></pre></div>
    <div class="code"><button class="copy" data-copy="curl2">Copy</button><pre><code id="curl2">${curl2}</code></pre></div>
    <div class="code"><button class="copy" data-copy="curl3">Copy</button><pre><code id="curl3">${curl3}</code></pre></div>
  `;
  els.devNotes.querySelectorAll('.copy').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-copy');
      const code = els.devNotes.querySelector(`#${CSS.escape(id)}`)?.innerText || '';
      navigator.clipboard?.writeText(code);
      const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(()=> btn.textContent = t, 1200);
    });
  });
}
