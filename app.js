const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const P={box:"M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",in:"M12 4v12M7 11l5 5 5-5M5 20h14",out:"M12 20V8M7 13l5-5 5 5M5 4h14",tr:"M4 8h14l-3-3M20 16H6l3 3",inv:"M9 4h6v3H9zM7 6H5v15h14V6h-2M9 13l2 2 4-4",home:"M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z",rep:"M4 20V10M10 20V4M16 20v-8M22 20H2",warn:"M12 3l10 18H2zM12 10v5M12 18v.01",scan:"M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16"};
const ic=(k,s=22)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[k]}"/></svg>`;
const money=n=>Math.round(n).toLocaleString('fr-FR')+' DA';
const fdate=t=>new Date(t).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const CATS=['Électricité','Plomberie','Peinture','Maçonnerie','Autre'];
const db=supabase.createClient(CONFIG.url,CONFIG.key);
let U=null,PF=null,SITE=null,A=[],W=[],AP=[],M=[],C=[],tab='home',F={type:'all',q:'',from:'',to:'',cat:'Tout',sq:'',low:false};
const ERR={insufficient_stock:'Stock insuffisant.',bad_qty:'Quantité invalide.',not_member:'Compte non rattaché à une entreprise.'};
const msg=e=>e.code=='23505'?'Ce code est déjà utilisé par un autre article.':(ERR[(e.message||'').trim()]||e.message||'Erreur');
const chk=r=>{if(r.error)throw r.error;return r.data};
const show=h=>{$('#app').innerHTML=h};
const toast=t=>{const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',2800)};
const day0=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()};
const close_=()=>$('#ov').style.display='none';
let scanner=null;
async function stopScan(){try{if(scanner){await scanner.stop();scanner.clear()}}catch(e){}scanner=null;$('#sc').style.display='none'}
async function scan(cb){let got=false;const fin=c=>{if(got||!c)return;got=true;stopScan();cb(String(c).trim())};
  $('#sc').style.display='flex';$('#scm').textContent='';$('#scin').value='';$('#scok').onclick=()=>fin($('#scin').value);
  try{scanner=new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:260,height:160}},fin,()=>{})}
  catch(e){$('#scm').textContent='Caméra indisponible : saisissez le code ci-dessous.'}}
async function run(fn){const er=$('#er'),ok=$('#ok');er.textContent='';ok.disabled=true;try{await fn()}catch(e){er.textContent=msg(e)}ok.disabled=false}
const field=(id,label,attrs='')=>`<div class="lbl">${label}</div><input class="in" id="${id}" ${attrs}>`;

async function boot(){
  if(CONFIG.url.includes('VOTRE'))return show('<div class="card auth"><b>Configuration manquante</b><p class="mut">Ouvrez <code>config.js</code> et collez l\'URL et la clé publique de votre projet Supabase.</p></div>');
  const {data:{session}}=await db.auth.getSession();U=session&&session.user;
  if(!U){$('#nav').innerHTML='';return authView()}
  PF=chk(await db.from('profiles').select('*').eq('id',U.id).maybeSingle());
  if(!PF)return onboard();
  SITE=chk(await db.from('sites').select('*').order('name').limit(1))[0];
  if(!SITE)return PF.role=='owner'?setupView():show('<div class="card auth">Aucun chantier configuré. Demandez au patron de le créer.</div>');
  await loadAll();render()}
async function loadAll(){
  const q=t=>db.from(t).select('*').eq('site_id',SITE.id);
  const [a,w,ap,m,c]=await Promise.all([q('items').order('name'),db.from('workers').select('*').eq('active',true).order('name'),q('apartments').order('code'),
    db.from('movements').select('*,items(name),workers(name),apartments(building,code),profiles(full_name)').eq('site_id',SITE.id).order('created_at',{ascending:false}).limit(1000),q('apartment_costs')]);
  A=chk(a);W=chk(w);AP=chk(ap);C=chk(c);
  M=chk(m).map(x=>({ts:new Date(x.created_at).getTime(),type:x.type,name:x.items.name,qty:x.qty,worker:x.workers?x.workers.name:'',apt:x.apartments?x.apartments.building+' '+x.apartments.code:'',cost:x.qty*x.unit_price,by:x.profiles?x.profiles.full_name:''}))}

function authView(){show(`<div class="auth"><div class="logo">${ic('box')}</div><h1>Stock Chantier</h1><p class="mut">Connectez-vous pour gérer votre stock.</p>${field('em','Email','type="email" autocomplete="email"')}${field('pw','Mot de passe','type="password" autocomplete="current-password"')}<div class="err" id="er"></div><button class="btn" id="ok" data-a="login">Se connecter</button><button class="btn sec" data-a="signup" style="margin-top:10px">Créer un compte</button></div>`)}
async function auth(signup){const email=$('#em').value.trim(),password=$('#pw').value;if(!email||password.length<6)return $('#er').textContent='Email et mot de passe (6 caractères minimum).';
  await run(async()=>{const r=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});if(r.error)throw r.error;if(!r.data.session)return toast('Compte créé. Confirmez votre email puis connectez-vous.');boot()})}
function onboard(){show(`<div class="auth"><h1>Bienvenue</h1><p class="mut">Créez l'espace de votre entreprise.</p>${field('co','Nom de l\'entreprise')}${field('nm','Votre nom')}<div class="err" id="er"></div><button class="btn" id="ok" data-a="mkco">Continuer</button></div>`)}
function setupView(){show(`<div class="auth"><h1>Votre chantier</h1><p class="mut">Ces informations pourront être complétées plus tard.</p>${field('sn','Nom du chantier')}${field('sb','Bâtiment (ex : Bloc B)')}<div class="lbl">Appartements (séparés par des virgules)</div><input class="in" id="sa" placeholder="01, 02, 03, 04"><div class="lbl">Ouvriers (un par ligne : nom, métier)</div><textarea class="in" id="sw" placeholder="Karim, Plombier&#10;Samir, Électricien"></textarea><div class="err" id="er"></div><button class="btn" id="ok" data-a="mksite">Créer le chantier</button></div>`)}
async function mkSite(){const n=$('#sn').value.trim(),b=$('#sb').value.trim(),codes=$('#sa').value.split(',').map(s=>s.trim()).filter(Boolean),ws=$('#sw').value.split('\n').map(l=>l.split(',').map(s=>s.trim())).filter(l=>l[0]);
  if(!n||!b||!codes.length)return $('#er').textContent='Chantier, bâtiment et appartements obligatoires.';
  await run(async()=>{const cid=PF.company_id,s=chk(await db.from('sites').insert({company_id:cid,name:n}).select().single());
    chk(await db.from('apartments').insert(codes.map(c=>({company_id:cid,site_id:s.id,building:b,code:c}))));
    if(ws.length)chk(await db.from('workers').insert(ws.map(w=>({company_id:cid,name:w[0],trade:w[1]||null}))));boot()})}

function renderNav(){const L=[['home','Accueil','home'],['stock','Stock','box'],['mv','Mouvements','tr'],['rep','Rapports','rep']];$('#nav').innerHTML=L.map(l=>`<button class="${tab==l[0]?'on':''}" data-a="tab" data-t="${l[0]}">${ic(l[2])}${l[1]}</button>`).join('')}
function render(){renderNav();show({home,stock,mv,rep}[tab]());if(tab=='stock')fillStock();if(tab=='mv')fillMv()}
function home(){const t0=day0(),s=ty=>M.filter(m=>m.type==ty&&m.ts>=t0).reduce((a,m)=>a+m.qty,0),low=A.filter(a=>a.qty<=a.min_qty).length,tot=A.reduce((a,x)=>a+x.qty,0);
const Q=(k,l,a)=>`<button class="big" data-a="${a}"><div class="ic">${ic(k)}</div>${l}</button>`;
return `<div class="row" style="justify-content:space-between"><div class="top"><div class="logo">${ic('box')}</div>Stock Chantier</div><button class="chip" data-a="logout">Déconnexion</button></div><p>Bonjour, <b>${esc(PF.full_name)}</b> · ${PF.role=='owner'?'Propriétaire':'Magasinier'}</p><div class="pill">${esc(SITE.name)}</div>
<div class="hero"><div style="opacity:.8;font-size:13px">Stock total</div><b>${tot.toLocaleString('fr-FR')}</b> <span>unités</span></div>
<div class="grid2"><div class="card"><div class="mut">Entrées aujourd'hui</div><b style="font-size:26px;color:var(--t)">${s('in')}</b></div><div class="card"><div class="mut">Sorties aujourd'hui</div><b style="font-size:26px">${s('out')}</b></div></div>
<button class="card row" style="width:100%;margin-top:12px;text-align:left;background:var(--warn);cursor:pointer" data-a="lowlist"><div class="ic" style="background:transparent;color:var(--warnt)">${ic('warn')}</div><div class="grow"><b>À réapprovisionner</b><div class="mut">${low} article(s) sous le seuil</div></div></button>
<div class="lbl">Actions rapides</div><div class="grid2">${Q('in','Entrée','open" data-k="in')}${Q('out','Sortie','open" data-k="out')}${Q('tr','Transfert','soon')}${Q('inv','Inventaire','soon')}</div>`}
function stock(){return `<h2>Articles</h2><div class="row"><input class="in grow" id="sq" placeholder="Rechercher un article" value="${esc(F.sq)}" style="margin:0"><button class="circ" data-a="scanfind" aria-label="Scanner un article" style="background:var(--t);color:#fff;flex:none;width:48px;height:48px;border-radius:24px">${ic('scan')}</button></div><div style="height:10px"></div><div class="chips">${['Tout',...CATS].map(c=>`<button class="chip ${F.cat==c&&!F.low?'on':''}" data-a="cat" data-c="${c}">${c}</button>`).join('')}</div><div id="list"></div><button class="btn" data-a="open" data-k="art" style="margin-top:6px">+ Ajouter un article</button>`}
function fillStock(){const q=F.sq.toLowerCase();const L=A.filter(a=>(F.low?a.qty<=a.min_qty:(F.cat=='Tout'||a.category==F.cat))&&a.name.toLowerCase().includes(q));$('#list').innerHTML=L.map(a=>`<div class="card row item"><div class="ic">${ic('box')}</div><div class="grow"><b>${esc(a.name)}</b><div class="mut">${a.qty} en stock · ${money(a.unit_price)}</div></div><span class="badge ${a.qty<=a.min_qty?'w':''}">${a.qty<=a.min_qty?'Stock bas':'En stock'}</span></div>`).join('')||'<p class="mut">Aucun article.</p>'}
const filt=()=>M.filter(m=>(F.type=='all'||m.type==F.type)&&(!F.q||(m.name+m.worker+m.apt).toLowerCase().includes(F.q.toLowerCase()))&&(!F.from||m.ts>=new Date(F.from).getTime())&&(!F.to||m.ts<=new Date(F.to).getTime()+864e5-1));
function mv(){return `<h2>Mouvements</h2><div class="chips">${[['all','Tous'],['in','Entrées'],['out','Sorties']].map(c=>`<button class="chip ${F.type==c[0]?'on':''}" data-a="type" data-c="${c[0]}">${c[1]}</button>`).join('')}</div><input class="in" id="mq" placeholder="Rechercher (article, ouvrier, appartement)" value="${esc(F.q)}"><div class="grid2"><div><div class="mut">Du</div><input class="in" type="date" id="mf" value="${F.from}"></div><div><div class="mut">Au</div><input class="in" type="date" id="mt" value="${F.to}"></div></div><button class="btn" data-a="xl">Exporter en Excel</button><div class="mut" id="cnt" style="margin:12px 0 8px"></div><div id="list"></div>`}
function fillMv(){const L=filt();$('#cnt').textContent=L.length+' mouvement(s)';$('#list').innerHTML=L.map(m=>`<div class="card row item"><div class="ic">${ic(m.type=='in'?'in':'out')}</div><div class="grow"><b>${m.type=='in'?'Entrée':'Sortie'} · ${esc(m.name)} ×${m.qty}</b><div class="mut">${[m.worker,m.apt,fdate(m.ts)].filter(Boolean).map(esc).join(' · ')}</div></div><b>${money(m.cost)}</b></div>`).join('')||'<p class="mut">Aucun mouvement.</p>'}
function rep(){const E=C.map(c=>[c.building+' '+c.code,+c.cost]).sort((a,b)=>b[1]-a[1]),tot=E.reduce((a,e)=>a+e[1],0),mx=E[0]&&E[0][1]||1;
return `<h2>Coût par appartement</h2><div class="hero"><div style="opacity:.8;font-size:13px">Coût total des sorties</div><b>${money(tot)}</b></div><div class="card">${E.map(e=>`<div style="margin-bottom:14px"><div class="row" style="justify-content:space-between"><b>${esc(e[0])}</b><b>${money(e[1])}</b></div><div class="bar"><i style="width:${e[1]/mx*100}%"></i></div></div>`).join('')||'<p class="mut">Aucun appartement.</p>'}</div>`}

function sheet(title,body,ok,fn){$('#sh').innerHTML=`<h2 style="margin-top:0">${title}</h2>${body}<div class="err" id="er"></div><button class="btn" id="ok">${ok}</button><button class="btn sec" data-a="close" style="margin-top:10px">Annuler</button>`;$('#ov').style.display='flex';$('#ok').onclick=()=>run(fn)}
const sel=(id,L)=>`<select class="in" id="${id}">${L.map(l=>`<option value="${esc(l[0])}">${esc(l[1])}</option>`).join('')}</select>`;
const done=async t=>{close_();await loadAll();render();toast(t)};
function open(k,pre){
  if(k=='art')return sheet('Nouvel article',`${field('an','Nom')}<div class="lbl">Code-barres (optionnel)</div><div class="row"><input class="in grow" id="ab" style="margin:0" value="${esc(pre||'')}"><button class="circ" data-a="scanfield" aria-label="Scanner" style="background:var(--t);color:#fff;flex:none;width:48px;height:48px;border-radius:24px">${ic('scan')}</button></div><div class="lbl">Catégorie</div>${sel('ac',CATS.map(c=>[c,c]))}${field('ap','Prix unitaire (DA)','type="number" inputmode="numeric"')}${field('aq','Quantité initiale','type="number" inputmode="numeric" value="0"')}${field('am','Seuil minimum','type="number" inputmode="numeric" value="5"')}`,'Ajouter',async()=>{
    const n=$('#an').value.trim(),p=+$('#ap').value,q=+$('#aq').value|0;if(!n||$('#ap').value===''||p<0)throw{message:'Nom et prix obligatoires.'};
    const it=chk(await db.from('items').insert({company_id:PF.company_id,site_id:SITE.id,name:n,category:$('#ac').value,unit_price:p,barcode:$('#ab').value.trim()||null,min_qty:Math.max(0,+$('#am').value|0),qty:0}).select().single());
    if(q>0)chk(await db.rpc('record_movement',{p_item:it.id,p_type:'in',p_qty:q}));await done('Article ajouté')});
  if(!A.length)return toast('Ajoutez d\'abord un article.');
  const out=k=='out';sheet(out?'Sortie de stock':'Entrée de stock',`<div class="lbl">Article</div><button class="btn sec" data-a="scanitem" style="min-height:48px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px">${ic('scan',20)} Scanner l'article</button><div id="lk"></div>${sel('fa',A.map(a=>[a.id,`${a.name} (stock ${a.qty})`]))}${out?`<div class="lbl">Ouvrier</div>${sel('fw',W.map(w=>[w.id,w.name+(w.trade?' · '+w.trade:'')]))}<div class="lbl">Appartement</div>${sel('fp',AP.map(a=>[a.id,a.building+' '+a.code]))}`:`${field('fs','Fournisseur (optionnel)')}`}<div class="lbl">Quantité</div><div class="step"><button data-a="q" data-d="-1" aria-label="Moins">−</button><input class="in" id="fq" type="number" inputmode="numeric" value="1"><button data-a="q" data-d="1" aria-label="Plus">+</button></div><div id="est" class="mut"></div>`,out?'Valider la sortie':"Valider l'entrée",async()=>{
    const q=+$('#fq').value;if(!(q>=1)||q%1)throw{message:'Quantité invalide.'};if(out&&(!W.length||!AP.length))throw{message:'Ajoutez des ouvriers et des appartements.'};
    chk(await db.rpc('record_movement',{p_item:$('#fa').value,p_type:k,p_qty:q,p_worker:out?$('#fw').value:null,p_apartment:out?$('#fp').value:null,p_supplier:out?null:($('#fs').value.trim()||null)}));await done(out?'Sortie enregistrée':'Entrée enregistrée')});est()}
function est(){const a=A.find(x=>x.id==($('#fa')||{}).value),q=+($('#fq')||{}).value||0;if($('#est')&&a)$('#est').textContent='Coût : '+money(q*a.unit_price)}
function xl(){const L=filt();if(!L.length)return toast('Aucun mouvement à exporter.');
  const rows=[['Date','Type','Article','Quantité','Ouvrier','Appartement','Coût (DA)','Saisi par']].concat(L.map(m=>[fdate(m.ts),m.type=='in'?'Entrée':'Sortie',m.name,m.qty,m.worker,m.apt,m.cost,m.by]));
  const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:16},{wch:9},{wch:28},{wch:10},{wch:22},{wch:14},{wch:12},{wch:16}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Mouvements');
  XLSX.writeFile(wb,'mouvements-stock-'+new Date().toISOString().slice(0,10)+'.xlsx')}

document.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b)return;const d=b.dataset,a=d.a;
if(a=='tab'){tab=d.t;F.low=false;render()}else if(a=='open')open(d.k);else if(a=='close')close_();else if(a=='soon')toast('Bientôt disponible');else if(a=='xl')xl();
else if(a=='cat'){F.cat=d.c;F.low=false;render()}else if(a=='type'){F.type=d.c;render()}else if(a=='lowlist'){tab='stock';F.low=true;render()}
else if(a=='q'){const i=$('#fq');i.value=Math.max(1,(+i.value||1)+ +d.d);est()}
else if(a=='login')auth(false);else if(a=='signup')auth(true);else if(a=='mksite')mkSite();
else if(a=='mkco'){const c=$('#co').value.trim(),n=$('#nm').value.trim();if(!c||!n)return $('#er').textContent='Tous les champs sont obligatoires.';await run(async()=>{chk(await db.rpc('create_company',{p_company:c,p_name:n}));boot()})}
else if(a=='scanstop')stopScan();
else if(a=='scanfield')scan(c=>{$('#ab').value=c});
else if(a=='scanfind')scan(c=>{const it=A.find(x=>x.barcode===c);if(it){F.sq=it.name;F.cat='Tout';F.low=false;render();toast(it.name)}else{toast('Code inconnu : créez l\'article.');open('art',c)}});
else if(a=='scanitem')scan(c=>{const it=A.find(x=>x.barcode===c);if(it){$('#fa').value=it.id;est();$('#lk').innerHTML='';toast(it.name)}else $('#lk').innerHTML=`<div class="card" style="margin-bottom:10px"><b>Code inconnu</b><div class="mut">${esc(c)}</div><div class="mut">Choisissez l'article dans la liste, puis associez-le : la prochaine fois, un scan suffira.</div><button class="btn" style="min-height:46px;margin-top:8px" data-a="link" data-c="${esc(c)}">Associer à l'article choisi</button></div>`});
else if(a=='link')await run(async()=>{chk(await db.rpc('set_item_barcode',{p_item:$('#fa').value,p_barcode:d.c}));await loadAll();$('#lk').innerHTML='';toast('Code associé à l\'article')});
else if(a=='logout'){await db.auth.signOut();boot()}});
document.addEventListener('input',e=>{const i=e.target.id;if(i=='sq'){F.sq=e.target.value;fillStock()}else if(i=='mq'){F.q=e.target.value;fillMv()}else if(i=='mf'){F.from=e.target.value;fillMv()}else if(i=='mt'){F.to=e.target.value;fillMv()}else if(i=='fq'||i=='fa')est()});
boot().catch(e=>show('<div class="card auth err">'+esc(msg(e))+'</div>'));
