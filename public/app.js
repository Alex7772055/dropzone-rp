const $ = s => document.querySelector(s);
let state = { user: null, cases: [], authMode: 'register', adminEligible: false };
let toastTimer;
async function api(url, options={}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers||{}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(()=>({error:'Ошибка сервера.'}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие.');
  return data;
}
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.classList.remove('show'), 3000);
}
function setUser(user) { state.user = user || null; renderAccount(); renderInventory(); const b=$('#adminAccessButton'); if(b) b.classList.toggle('hidden', !(state.user && state.user.username.toLowerCase() === 'alex7772055' && state.adminEligible)); if(!state.user) $('#adminPanel').classList.add('hidden'); }
function renderAccount() {
  $('#balance').textContent = `◈ ${(state.user?.balance ?? 0).toLocaleString('ru-RU')}`;
  $('#authButton').textContent = state.user ? `${state.user.username} · Выйти` : 'Войти';
  $('#dailyButton').textContent = state.user ? 'Забрать бонус +250' : 'Войди за бонусом';
}
function renderCases() {
  $('#caseGrid').innerHTML = state.cases.map((c,i)=>`<article class="case-card"><div class="case-visual" style="background:radial-gradient(circle,${c.color}35,#171a15 70%)"><span class="case-tag">DROPZONE / ${String(i+1).padStart(3,'0')}</span><div class="case-icon">${c.icon}</div></div><div class="case-info"><h3>${escapeHtml(c.name)}</h3><p>${c.preview.length} предмета · шанс на каждый указан ниже</p><div class="case-bottom"><span class="price">◈ ${c.price.toLocaleString('ru-RU')}</span><button class="btn" data-open="${c.id}">Открыть ↗</button></div><details class="odds"><summary>Содержимое и шансы</summary>${c.preview.map(item=>`<div class="odds-row"><span>${item.icon} ${escapeHtml(item.name)} <small>${item.rarity}</small></span><b>${item.chance}%</b></div>`).join('')}</details></div></article>`).join('');
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function animateOpening(c, resultPromise){
  const modal=$('#openingModal'), track=$('#rouletteTrack');
  $('#openingCaseName').textContent=c.name; $('#openingStatus').textContent='Кейс открывается...';
  const preview=c.preview; const cells=Array.from({length:28},(_,i)=>preview[i%preview.length]);
  track.style.transition='none'; track.style.transform='translateX(0)';
  track.innerHTML=cells.map((item,i)=>`<div class="roulette-item" style="--case-color:${c.color}"><span>${item.icon}</span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.rarity)}</small></div>`).join('');
  modal.classList.remove('hidden'); await sleep(50);
  const itemWidth=150, targetIndex=24; const selected=preview[Math.floor(Math.random()*preview.length)];
  // Server is authoritative; the strip is decorative, the actual drop is returned by the API.
  const response=await resultPromise; const actual=response.item;
  const finalCell=`<div class="roulette-item roulette-winner" style="--case-color:${c.color}"><span>${actual.icon}</span><b>${escapeHtml(actual.name)}</b><small>${escapeHtml(actual.rarity)}</small></div>`;
  const nodes=track.children; if(nodes.length) nodes[targetIndex].outerHTML=finalCell;
  track.style.transition='transform 3.2s cubic-bezier(.08,.72,.12,1)'; track.style.transform=`translateX(-${targetIndex*itemWidth-125}px)`;
  await sleep(3300); $('#openingStatus').textContent=`ВЫПАЛО: ${actual.icon} ${actual.name}`; await sleep(1100); modal.classList.add('hidden'); return response;
}
function renderInventory() {
  const inv = state.user?.inventory || [];
  $('#itemCount').textContent = `${inv.length} предметов`;
  if (!state.user) { $('#inventoryGrid').innerHTML='<div class="empty">Войди в аккаунт, чтобы сохранять предметы.</div>'; return; }
  if (!inv.length) { $('#inventoryGrid').innerHTML='<div class="empty">Пока пусто.<br>Открой кейс, чтобы получить первый предмет.</div>'; return; }
  $('#inventoryGrid').innerHTML = inv.slice().reverse().map(item=>`<div class="inventory-item"><div class="item-icon">${item.icon}</div><h4>${escapeHtml(item.name)}</h4><div class="price">◈ ${item.value.toLocaleString('ru-RU')}</div><button class="btn" data-sell="${item.id}">Продать</button><details class="trade"><summary>Передать игроку</summary><form data-trade="${item.id}"><input name="username" required minlength="3" placeholder="Имя игрока"><button class="btn">Передать</button></form></details></div>`).join('');
}
async function renderLeaderboard() {
  try { const {users}=await api('/api/leaderboard'); $('#leaderboard').innerHTML=users.length?users.map((u,i)=>`<div class="rank-row"><span class="rank-num ${i===0?'first':''}">${String(i+1).padStart(2,'0')}</span><div><div class="rank-name">${escapeHtml(u.username)} ${state.user?.username===u.username?'(ты)':''}</div><div class="rank-sub">${u.items} предметов</div></div><span class="rank-coins">◈ ${u.balance.toLocaleString('ru-RU')}</span></div>`).join(''):'<div class="empty">Пока нет игроков. Стань первым!</div>'; } catch {}
}
async function renderActivity() {
  try { const {activity}=await api('/api/activity'); $('#activity').innerHTML=activity.length?activity.map(a=>`<div class="activity-row"><div class="activity-symbol">${a.type==='drop'?'✦':a.type==='daily'?'◈':a.type==='sell'?'↗':'＋'}</div><div class="details"><b>${escapeHtml(a.username)}</b><span>${escapeHtml(a.details)}</span></div><time>${new Date(a.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join(''):'<div class="empty">Здесь появятся последние события.</div>'; } catch {}
}
function escapeHtml(s='') { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function openModal(mode='register') { state.authMode=mode; $('#modalTitle').textContent=mode==='register'?'Создать аккаунт':'С возвращением'; $('#submitAuth').textContent=mode==='register'?'Создать аккаунт':'Войти'; $('#switchAuth').textContent=mode==='register'?'Уже есть аккаунт? Войти':'Нет аккаунта? Зарегистрироваться'; $('#authModal').classList.remove('hidden'); }
function closeModal() { $('#authModal').classList.add('hidden'); }
$('#authButton').addEventListener('click', async()=>{ if(state.user){try{await api('/api/logout',{method:'POST'});setUser(null);toast('Ты вышел из аккаунта.');}catch(e){toast(e.message)}}else openModal(); });
$('#closeModal').addEventListener('click',closeModal);
$('#authModal').addEventListener('click',e=>{if(e.target.id==='authModal')closeModal();});
$('#switchAuth').addEventListener('click',()=>openModal(state.authMode==='register'?'login':'register'));
$('#authForm').addEventListener('submit',async e=>{
  e.preventDefault(); const form=new FormData(e.currentTarget);
  try { const data=await api('/api/'+state.authMode,{method:'POST',body:{username:form.get('username'),password:form.get('password')}}); setUser(data.user); closeModal(); toast(state.authMode==='register'?'Аккаунт создан! Начислено 1000 монет.':'Вход выполнен.'); await refresh(); }
  catch(err){toast(err.message);}
});
$('#dailyButton').addEventListener('click',async()=>{if(!state.user){openModal();return;}try{const d=await api('/api/daily',{method:'POST'});setUser(d.user);toast(d.message);await refresh();}catch(e){toast(e.message)}});
$('#caseGrid').addEventListener('click',async e=>{
  const btn=e.target.closest('[data-open]'); if(!btn)return;
  if(!state.user){openModal();return;}
  const c=state.cases.find(x=>x.id===btn.dataset.open); btn.disabled=true;btn.textContent='Открываем…';
  try{const pending=api('/api/open',{method:'POST',body:{caseId:btn.dataset.open}});const d=await animateOpening(c,pending);setUser(d.user);toast(`Выпало: ${d.item.icon} ${d.item.name}!`);await refresh();}
  catch(err){$('#openingModal').classList.add('hidden');toast(err.message)}finally{btn.disabled=false;btn.textContent='Открыть ↗';}
});
$('#inventoryGrid').addEventListener('click',async e=>{
  const sell=e.target.closest('[data-sell]');
  if(sell){sell.disabled=true;try{const d=await api('/api/sell/'+encodeURIComponent(sell.dataset.sell),{method:'POST'});setUser(d.user);toast(d.message);await refresh();}catch(err){toast(err.message)}return;}
  const trade=e.target.closest('form[data-trade]');
  if(trade){e.preventDefault();const username=new FormData(trade).get('username');const itemId=trade.dataset.trade;try{const d=await api('/api/trade',{method:'POST',body:{username,itemId}});setUser(d.user);toast(d.message);await refresh();}catch(err){toast(err.message)}}
});
async function refresh(){await Promise.all([renderLeaderboard(),renderActivity()]);}
async function loadAdminUsers(){
  const d=await api('/api/admin/users');
  $('#adminTotalUsers').textContent=d.totalUsers.toLocaleString('ru-RU');
  $('#adminTotalCoins').textContent=d.totalCoins.toLocaleString('ru-RU');
  $('#adminUsers').innerHTML=d.users.length?d.users.map(u=>`<div class="admin-user-row"><div><b>${escapeHtml(u.username)}</b><small>${u.items} предметов · регистрация ${new Date(u.joinedAt).toLocaleDateString('ru-RU')}</small></div><strong>◈ ${u.balance.toLocaleString('ru-RU')}</strong></div>`).join(''):'<div class="empty">Пока нет игроков.</div>';
}
$('#adminAccessButton').addEventListener('click',async()=>{
  if(!state.user || state.user.username.toLowerCase() !== 'alex7772055'){toast('Войди под аккаунтом Alex7772055.');return;}
  const key=window.prompt('Введи секретный ключ администратора:'); if(key===null)return;
  try{await api('/api/admin/verify',{method:'POST',body:{key}});$('#adminPanel').classList.remove('hidden');await loadAdminUsers();$('#adminPanel').scrollIntoView({behavior:'smooth'});toast('Доступ к панели открыт.');}
  catch(e){toast(e.message)}
});
$('#adminLogout').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST'});}catch{} $('#adminPanel').classList.add('hidden');toast('Панель закрыта.');});
$('#adminBalanceForm').addEventListener('submit',async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget);
  try{const d=await api('/api/admin/balance',{method:'POST',body:{username:f.get('username'),amount:Number(f.get('amount'))}});toast(`Баланс ${d.username}: ${d.balance} монет`);e.currentTarget.reset();await loadAdminUsers();await renderLeaderboard();}
  catch(err){toast(err.message)}
});
async function init(){
  try{const d=await api('/api/config');state.cases=d.cases;state.adminEligible=Boolean(d.adminEligible);setUser(d.user);}catch(e){toast(e.message)}
  renderCases(); await refresh();
}
init();