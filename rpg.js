/* Crawler Command Center 2.0 — additive RPG layer */
(function(){
  const defaults={xpEvents:[],log:[],bosses:[],trophies:[],unlocks:{},recaps:{}};
  db.rpg=Object.assign({},defaults,db.rpg||{});
  for(const k of Object.keys(defaults)) if(!db.rpg[k]) db.rpg[k]=defaults[k];
  const $id=id=>document.getElementById(id);
  const esc2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rarityXP={common:10,uncommon:20,rare:40,epic:75,legendary:125,unique:200};
  const defs=[
    ['firstquest','The Bare Minimum','Complete your first daily quest.','common',()=>Object.values(db.daily).reduce((n,d)=>n+(d.todo||[]).filter(t=>t.done).length,0)>=1],
    ['habits10','A Pattern Emerges','Complete ten habits.','uncommon',()=>db.habits.reduce((n,h)=>n+(h.done||[]).length,0)>=10],
    ['firstbook','Lore Goblin','Finish your first book.','common',()=>db.books.some(b=>b.status==='Finished')],
    ['firstboss','Boss Problems','Defeat your first boss.','uncommon',()=>db.rpg.bosses.some(b=>b.defeatedAt)],
    ['level5','Not Completely Doomed','Reach level five.','rare',()=>level().level>=5],
    ['level10','The System Has Concerns','Reach level ten.','epic',()=>level().level>=10],
    ['boss5','Local Menace','Defeat five bosses.','legendary',()=>db.rpg.bosses.filter(b=>b.defeatedAt).length>=5],
    ['secret666','The Number Is Probably Fine','Accumulate 666 lifetime XP.','unique',()=>level().xp>=666,true]
  ];
  function level(){const xp=db.rpg.xpEvents.reduce((n,e)=>n+(+e.amount||0),0);return{xp,level:Math.floor(xp/250)+1,progress:xp%250}}
  function log(msg,type){db.rpg.log.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),msg,type});db.rpg.log=db.rpg.log.slice(0,300)}
  function award(id,amount,msg){if(db.rpg.xpEvents.some(e=>e.id===id))return;db.rpg.xpEvents.push({id,amount:Math.max(0,+amount||0),date:new Date().toISOString(),msg});log(msg+' · +'+amount+' XP','XP')}
  function check(){defs.forEach(a=>{if(!db.rpg.unlocks[a[0]]&&a[4]()){db.rpg.unlocks[a[0]]=new Date().toISOString();award('achievement:'+a[0],rarityXP[a[3]],'Achievement unlocked: '+a[1])}})}
  const oldBookStatus=window.setBookStatus,oldMarkCooked=window.markCooked;
  window.setBookStatus=function(i,v){const b=db.books[i];oldBookStatus(i,v);if(b&&v==='Finished'){award('book-finished:'+String(b.name).toLowerCase(),50,'Book finished: '+b.name);check();save();render()}};
  window.markCooked=function(i){const r=db.recipes[i];oldMarkCooked(i);if(r){award('recipe-first-cook:'+String(r.name).toLowerCase(),10,'First cook logged: '+r.name);check();save();render()}};
  const oldTaskDone=window.taskDone,oldToggleTask=window.toggleTask,oldHabitToggle=window.habitToggle;
  window.taskDone=function(id,v){const t=dRec().todo.find(x=>x.id===id);if(t){t.done=v;if(v)award('quest:'+id,10,'Daily quest completed: '+t.text)}save();check();render()};
  window.toggleTask=function(id,v){const t=db.daily[today()]?.todo?.find(x=>x.id===id);if(t){t.done=v;if(v)award('quest:'+id,10,'Daily quest completed: '+t.text)}save();check();render()};
  window.habitToggle=function(i,s){const h=db.habits[i];if(!h)return;h.done??=[];const had=h.done.includes(s);h.done=had?h.done.filter(x=>x!==s):[...h.done,s];if(!had){award('habit:'+i+':'+s,5,'Habit completed: '+h.name);if(db.habits.length&&db.habits.every(x=>(x.done||[]).includes(s)))award('allhabits:'+s,20,'All habits completed for the day')}save();check();render()};
  const style=document.createElement('style');style.textContent=`:root{--bg:#070a12;--p:#10182a;--line:#284b66;--gold:#eaff00;--muted:#91a9bb;--ink:#e8f7ff;--cyan:#00eaff;--green:#b7ff00;--red:#ff3d9a}body{background:radial-gradient(ellipse at top,#111b32 0%,var(--bg) 58%);color:var(--ink);font-family:system-ui,sans-serif}h1,h2,h3,.eyebrow{letter-spacing:.08em;text-transform:uppercase}.panel,.module,.card{border-color:#254b65;box-shadow:0 0 0 1px #00eaff12,0 0 16px #00eaff0c;background:linear-gradient(145deg,#111a2b,#0b101d)}.btn,.module{border-color:#00eaff66}.btn.gold{color:#f5ff00;border-color:#eaff0088;box-shadow:0 0 12px #eaff0020}.module i{color:#00eaff;text-shadow:0 0 10px #00eaff}.modulegrid{grid-template-columns:repeat(2,minmax(0,1fr))}.rpgbar{height:9px;background:#090d1b;border:1px solid var(--line);margin:8px 0}.rpgbar span{display:block;height:100%;background:linear-gradient(90deg,#ff2aa6,#00eaff,#f5ff00);box-shadow:0 0 10px #00eaff66}.rpgitem{border:1px solid var(--line);padding:12px;margin:8px 0;background:#101326}.rpgmuted{color:var(--muted);font:11px system-ui}input,select,textarea{accent-color:#00eaff}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #eaff00;outline-offset:2px}`;document.head.append(style);
  const newPages=[['dungeon','⚔','Dungeon'],['trophies','♜','Trophy Room'],['achievements','✧','Achievement Gallery'],['systemLog','⌁','System Log'],['recaps','▣','Season Recap']];
  const nav=document.querySelector('.modulegrid');
  const oldHome=window.home;
  window.home=function(){const l=level();const original=oldHome();const cards='<section class="panel s12"><h3>CRAWLER PROGRESSION</h3><div class="row between"><b>LEVEL '+l.level+'</b><b>'+l.xp.toLocaleString()+' LIFETIME XP</b></div><div class="rpgbar"><span style="width:'+(l.progress/250*100)+'%"></span></div><small class="rpgmuted">'+l.progress+' / 250 XP to next level · Lifetime XP never resets</small></section>';return cards+original+'<div class="modulegrid">'+newPages.map(p=>'<button class="module" onclick="go(\''+p[0]+'\')"><i>'+p[1]+'</i><b>'+p[2]+'</b><small>OPEN MODULE</small></button>').join('')+'</div>'};
  const oldRender=window.render;
  window.render=function(){if(newPages.some(p=>p[0]===page)){document.getElementById('view').innerHTML='<div class="row" style="margin:8px 0 14px"><button class="btn" onclick="go(\'home\')">← DASHBOARD</button></div>'+({dungeon,trophies,achievements,systemLog,recaps}[page])();bind();return}oldRender();if(page!=='home'){$id('view').insertAdjacentHTML('afterbegin','<div class="row" style="margin:8px 0 14px"><button class="btn" onclick="go(\'home\')">← DASHBOARD</button></div>')}};
  window.go=function(p){page=p;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.p===p));const item=pages.find(x=>x[0]===p)||newPages.find(x=>x[0]===p);$id('title').textContent=p==='home'?'CRAWLER, YOUR RUN CONTINUES':item?.[2]||p.toUpperCase();render()};
  function progress(){const l=level();return '<section class="panel s12"><h3>LEVEL '+l.level+' · '+l.xp+' LIFETIME XP</h3><div class="rpgbar"><span style="width:'+l.progress/250*100+'%"></span></div><small class="rpgmuted">'+l.progress+' / 250 XP to next level</small></section>'}
  function dungeon(){const tiers=['Neighborhood Boss','Borough Boss','City Boss'];return '<div class="grid">'+panel('REGISTER A BOSS','<form id="rpgBossForm"><label>Boss name</label><input name="name" required><label>Classification</label><select name="tier">'+tiers.map(x=>'<option>'+x+'</option>').join('')+'</select><label>Difficulty (1–10)</label><input name="difficulty" type="number" min="1" max="10" value="5"><label>XP reward</label><input name="reward" type="number" min="0" value="100"><label>Prerequisite bosses</label><select name="prereqs" multiple size="4">'+db.rpg.bosses.map(b=>'<option value="'+b.id+'">'+esc2(b.name)+' · '+esc2(b.tier)+'</option>').join('')+'</select><label>Objectives — one per line</label><textarea name="objectives"></textarea><button class="btn gold">Register boss</button></form>','s6')+panel('BOSS ENCOUNTERS',db.rpg.bosses.map(b=>bossCard(b)).join('')||'<p class="rpgmuted">No bosses registered yet.</p>','s6')+'</div>'}
  function unlocked(b){return b.tier==='Neighborhood Boss'||((b.prereqs||[]).length>0&&b.prereqs.every(id=>db.rpg.bosses.some(x=>x.id===id&&x.defeatedAt)))}
  function bossCard(b){const total=(b.objectives||[]).length,done=(b.objectives||[]).filter(x=>x.done).length,pct=total?done/total*100:0;return '<div class="rpgitem"><div class="row between"><b>'+esc2(b.name)+'</b><span class="tag">'+esc2(b.tier)+'</span></div><p class="rpgmuted">Difficulty '+b.difficulty+'/10 · Reward '+b.reward+' XP · '+(b.defeatedAt?'DEFEATED':unlocked(b)?'UNLOCKED':'LOCKED')+'</p><div class="rpgbar"><span style="width:'+pct+'%"></span></div><small>'+done+'/'+total+' objectives</small>'+(unlocked(b)&&!b.defeatedAt?(b.objectives||[]).map((o,i)=>'<label><input style="width:auto" type="checkbox" '+(o.done?'checked':'')+' onchange="rpgObjective(\''+b.id+'\','+i+',this.checked)"> '+esc2(o.text)+'</label>').join(''):'')+(!b.defeatedAt&&unlocked(b)&&done===total?'<button class="btn gold" onclick="rpgDefeat(\''+b.id+'\')">Confirm boss defeat</button>':'')+'</div>'}
  window.rpgObjective=function(id,i,v){const b=db.rpg.bosses.find(x=>x.id===id),o=b?.objectives?.[i];if(!o)return;o.done=v;if(v)award('boss-objective:'+id+':'+i,10,'Boss objective completed: '+o.text);save();check();render()};
  window.rpgDefeat=function(id){const b=db.rpg.bosses.find(x=>x.id===id);if(!b||b.defeatedAt||!unlocked(b)||(b.objectives||[]).some(o=>!o.done))return;b.defeatedAt=today();award('boss:'+id,b.reward,'Boss defeated: '+b.name);db.rpg.trophies.push({id:crypto.randomUUID(),bossId:id,name:b.name,tier:b.tier,date:today(),reward:b.reward});log('BOSS DOWN: '+b.name+'. The System is pretending this was expected.','BOSS');save();check();render()};
  function trophies(){return progress()+panel('TROPHY ROOM',db.rpg.trophies.map(t=>'<div class="rpgitem"><b style="color:var(--gold)">♜ '+esc2(t.name)+'</b><p class="rpgmuted">'+esc2(t.tier)+' · Defeated '+t.date+' · '+t.reward+' XP</p></div>').join('')||'<p class="rpgmuted">No trophies yet.</p>','s12')}
  function achievements(){return progress()+panel('ACHIEVEMENT GALLERY',defs.map(a=>{const yes=!!db.rpg.unlocks[a[0]];return '<div class="rpgitem" style="opacity:'+(yes?1:.55)+'"><b>'+ (yes||!a[5]?a[1]:'???')+'</b><p class="rpgmuted">'+(yes||!a[5]?a[2]:'Secret achievement')+'</p><span class="tag">'+a[3].toUpperCase()+'</span> · '+(yes?'UNLOCKED':'LOCKED')+'</div>'}).join(''),'s12')}
  function systemLog(){return panel('SYSTEM LOG',db.rpg.log.map(x=>'<div class="rpgitem"><small class="rpgmuted">'+esc2(x.type)+' · '+new Date(x.date).toLocaleString()+'</small><p>'+esc2(x.msg)+'</p></div>').join('')||'No system notifications yet.','s12')}
  function recaps(){const m=pageMonth||today().slice(0,7),ev=db.rpg.xpEvents.filter(e=>e.date.slice(0,7)===m),tasks=Object.entries(db.daily).filter(([d])=>d.startsWith(m)).reduce((n,[,d])=>n+(d.todo||[]).filter(t=>t.done).length,0),habits=db.habits.reduce((n,h)=>n+(h.done||[]).filter(d=>d.startsWith(m)).length,0),boss=db.rpg.trophies.filter(t=>t.date.startsWith(m)).length;return '<div class="grid">'+panel('MONTHLY REPORT','<label>Month</label><input type="month" value="'+m+'" onchange="setRpgMonth(this.value)"><label>Personal highlight</label><textarea id="rpgHighlight" placeholder="What mattered this month? What are you proud of?"></textarea><button class="btn gold" onclick="archiveRpgMonth(\''+m+'\')">Archive snapshot</button><p><b>'+ev.reduce((n,e)=>n+e.amount,0)+' XP</b></p><div class="stat"><span>QUESTS COMPLETED</span><b>'+tasks+'</b></div><div class="stat"><span>HABIT COMPLETIONS</span><b>'+habits+'</b></div><div class="stat"><span>BOSSES DEFEATED</span><b>'+boss+'</b></div>','s6')+panel('ARCHIVED REPORTS',Object.entries(db.rpg.recaps).sort().reverse().map(([k,v])=>'<div class="rpgitem"><b>'+k+'</b> · '+v.xp+' XP · '+v.quests+' quests · '+v.habitCompletions+' habit completions · '+v.bosses+' bosses · '+v.achievements.length+' achievements'+(v.highlights?.length?'<p>'+v.highlights.map(esc2).join('<br>')+'</p>':'')+'</div>').join('')||'No snapshots archived.','s6')+'</div>'}
  let pageMonth=today().slice(0,7);window.setRpgMonth=function(m){pageMonth=m;render()};
  window.archiveRpgMonth=function(m){if(db.rpg.recaps[m])return alert('This month is already archived.');const ev=db.rpg.xpEvents.filter(e=>e.date.slice(0,7)===m),days=Object.entries(db.daily).filter(([d])=>d.startsWith(m)),quests=days.reduce((n,[,d])=>n+(d.todo||[]).filter(t=>t.done).length,0),habitCompletions=db.habits.reduce((n,h)=>n+(h.done||[]).filter(d=>d.startsWith(m)).length,0),achievements=Object.entries(db.rpg.unlocks).filter(([,d])=>String(d).startsWith(m)).map(([id])=>defs.find(a=>a[0]===id)?.[1]||id),bosses=db.rpg.trophies.filter(t=>t.date.startsWith(m));db.rpg.recaps[m]={xp:ev.reduce((n,e)=>n+e.amount,0),quests,habitCompletions,bosses:bosses.length,achievements,highlights:[($id('rpgHighlight')?.value||'').trim(),...ev.slice(-5).map(e=>e.msg)].filter(Boolean),archivedAt:new Date().toISOString()};save();render()};
  const oldBind=window.bind;
  window.bind=function(){oldBind();const f=$id('rpgBossForm');if(f)f.onsubmit=e=>{e.preventDefault();const q=e.target,o=Object.fromEntries(new FormData(q));const prereqs=[...q.prereqs.selectedOptions].map(x=>x.value),allowed=o.tier==='Borough Boss'?'Neighborhood Boss':o.tier==='City Boss'?'Borough Boss':null;if(allowed&&(!prereqs.length||prereqs.some(id=>db.rpg.bosses.find(b=>b.id===id)?.tier!==allowed)))return alert(o.tier+' requires at least one '+allowed+' prerequisite, and no other tier.');if(o.tier==='Neighborhood Boss'&&prereqs.length)return alert('Neighborhood Bosses start the chain and cannot have prerequisites.');db.rpg.bosses.push({id:crypto.randomUUID(),name:o.name.trim(),tier:o.tier,difficulty:Math.max(1,Math.min(10,+o.difficulty||5)),reward:Math.max(0,+o.reward||0),prereqs,objectives:o.objectives.split('\n').map(x=>x.trim()).filter(Boolean).map(text=>({text,done:false}))});log('New threat registered: '+o.name+'. Please remain calm.','BOSS');save();render()}};
  pages.push(...newPages);
  const navEl=$id('nav');if(navEl)navEl.style.display='none';
  const originalPetDetail=window.petDetail;
  window.petDetail=function(i){const p=db.dogs[i];if(!p)return;const view=$id('view');view.innerHTML='<div class="row" style="margin:8px 0"><button class="btn" onclick="go(\'dogs\')">← BACK TO PETS</button></div><div class="grid">'+panel('EDIT PET PROFILE','<form id="petEdit"><label>Name</label><input name="name" value="'+esc2(p.name)+'"><label>Breed</label><input name="breed" value="'+esc2(p.breed||'')+'"><label>Birthday / age</label><input name="age" value="'+esc2(p.age||'')+'"><label>Weight</label><input name="weight" value="'+esc2(p.weight||'')+'"><label>Medications</label><input name="medications" value="'+esc2(p.medications||'')+'"><label>Allergies</label><input name="allergies" value="'+esc2(p.allergies||'')+'"><label>Notes</label><textarea name="notes">'+esc2(p.notes||'')+'</textarea><button class="btn gold">Save profile</button></form>','s6')+panel('SYMPTOM HISTORY', (p.symptoms||[]).map((x,j)=>'<div class="rpgitem"><form id="petSym'+j+'"><label>Symptom</label><input name="symptom" value="'+esc2(x.symptom)+'"><label>Date</label><input name="date" type="date" value="'+esc2(x.date)+'"><label>Severity</label><input name="severity" value="'+esc2(x.severity)+'"><label>Type</label><input name="kind" value="'+esc2(x.kind)+'"><label>Duration</label><input name="duration" value="'+esc2(x.duration)+'"><label>Notes</label><textarea name="notes">'+esc2(x.notes)+'</textarea><button class="btn gold" type="button" onclick="savePetSymptom('+i+','+j+')">Save entry</button><button class="btn danger" type="button" onclick="deletePetSymptom('+i+','+j+')">Delete entry</button></form></div>').join('')||'No symptom history yet.','s6')+'</div><div class="panel s12"><h3>LOG A SYMPTOM</h3><form id="newPetSym"><label>Symptom</label><input name="symptom" required><label>Date</label><input name="date" type="date" value="'+today()+'"><label>Severity</label><select name="severity"><option>Mild</option><option>Moderate</option><option>Severe</option><option>Emergency</option></select><label>Type</label><select name="kind"><option>New symptom</option><option>Recurring issue</option><option>Resolved</option><option>Other observation</option></select><label>Duration</label><input name="duration"><label>Notes</label><textarea name="notes"></textarea><button class="btn gold">Save symptom</button></form></div>';
    $id('petEdit').onsubmit=e=>{e.preventDefault();Object.assign(p,Object.fromEntries(new FormData(e.target)));save();petDetail(i)};
    $id('newPetSym').onsubmit=e=>{e.preventDefault();p.symptoms??=[];p.symptoms.push(Object.fromEntries(new FormData(e.target)));save();petDetail(i)};
  };
  window.savePetSymptom=function(i,j){const f=$id('petSym'+j);Object.assign(db.dogs[i].symptoms[j],Object.fromEntries(new FormData(f)));save();petDetail(i)};
  window.deletePetSymptom=function(i,j){if(confirm('Delete this symptom entry?')){db.dogs[i].symptoms.splice(j,1);save();petDetail(i)}};
  const oldStatsPage=window.stats;window.stats=function(){const base=oldStatsPage();const l=level(),bars='<div class="grid">'+[['LIFETIME XP',Math.min(100,l.xp%250/250*100),l.xp+' XP · '+(250-l.progress)+' to next level'],['LEVEL PROGRESS',l.progress/250*100,'LEVEL '+l.level+' · '+l.progress+'/250 XP'],['HABIT COMPLETION',db.habits.length?Math.min(100,db.habits.reduce((n,h)=>n+(h.done||[]).filter(d=>d.startsWith(today().slice(0,7))).length,0)/(db.habits.length*30)*100):0,'This month · estimated against 30 days']].map(x=>panel(x[0],'<div class="rpgbar"><span style="width:'+x[1]+'%"></span></div><small class="rpgmuted">'+x[2]+'</small>','s4')).join('')+'</div>';return bars+base};
  const dailyHTML=window.daily;
  window.daily=function(){let out=dailyHTML();out=out.replace(/<button class="btn" onclick="setD\('sleep',[0-9]+\)">([0-9]+)h<\/button>/g,(m,n)=>'<button class="btn '+(String(window.dailySelectedSleep)===n?'primary':'')+'" onclick="setD(\'sleep\','+n+')">'+n+'h</button>');out=out.replace(/<label>Other drinks<\/label><input[^>]*name="otherDrinks"[^>]*>/,'');out=out.replace(/<label>Gold gained<\/label><input[^>]*name="moneyIn"[^>]*>/,m=>'<label>Gold gained ($)<\/label>'+m.replace('type="text"','type="number" step="0.01" min="0"'));out=out.replace(/<label>Gold spent<\/label><input[^>]*name="moneyOut"[^>]*>/,m=>'<label>Gold spent ($)<\/label>'+m.replace('type="text"','type="number" step="0.01" min="0"'));return out};
  Object.defineProperty(window,'dailySelectedSleep',{get:()=>String((db.daily[$id('dailyDate')?.value||today()]||{}).sleep||'')});
  check();
  /* The original app's renderer closes over global function bindings. Keep those bindings in sync with the RPG overrides. */
  home=window.home;render=window.render;bind=window.bind;petDetail=window.petDetail;stats=window.stats;daily=window.daily;
  render();

  /* Play-test usability fixes: structured quests, compact editing, stable daily date. */
  db.rpg.quests??=[];
  const dayKey=()=>today();
  function weekKey(date=dayKey()){
    const d=new Date(date+'T12:00:00');const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function questPeriod(q){return q.type==='Daily'?dayKey():q.type==='Weekly'?weekKey():'once'}
  function questActive(q){return !(q.donePeriods||[]).includes(questPeriod(q))}
  function questMarkup(q){
    const done=!questActive(q);
    return '<div class="rpgitem quest-row"><div class="row between"><b>'+esc2(q.name)+'</b><span class="tag">'+esc2(q.type)+'</span></div><div class="row between"><small class="rpgmuted">'+(done?'COMPLETED THIS '+(q.type==='One-time'?'RUN':q.type.toUpperCase()):'ACTIVE QUEST')+'</small><button class="btn '+(done?'':'gold')+'" '+(done?'disabled':'onclick="rpgQuestComplete(\''+q.id+'\')"')+'>'+(done?'✓ Complete':'Complete quest')+'</button></div></div>';
  }
  window.rpgQuestComplete=function(id){
    const q=db.rpg.quests.find(x=>x.id===id);if(!q||!questActive(q))return;
    q.donePeriods??=[];const period=questPeriod(q);q.donePeriods.push(period);
    award('structured-quest:'+id+':'+period,10,'Quest completed: '+q.name);
    log('Quest cleared: '+q.name+'. The System is legally required to act impressed.','QUEST');
    save();check();render();
  };
  function questPanel(){
    const active=db.rpg.quests.filter(questActive);
    const done=db.rpg.quests.filter(q=>!questActive(q));
    return panel('QUEST BOARD',active.map(questMarkup).join('')||'<p class="rpgmuted">No active quests. Suspiciously peaceful.</p>'+
      (done.length?'<details class="rpgitem"><summary>Completed this period ('+done.length+')</summary>'+done.map(questMarkup).join('')+'</details>':'' )+
      '<form id="structuredQuestForm" class="rpgitem"><h3>REGISTER A QUEST</h3><label>Quest name</label><input name="name" required maxlength="100" placeholder="What needs doing?"><label>Quest type</label><select name="type"><option>Daily</option><option>Weekly</option><option>One-time</option></select><button class="btn gold">Add quest</button></form>','s12');
  }
  const previousHome=window.home;
  window.home=function(){
    let out=previousHome();
    const pos=out.indexOf('<div class="grid">');
    if(pos>=0)out=out.slice(0,pos)+questPanel()+out.slice(pos);
    return out;
  };
  const previousDaily=window.daily;
  window.daily=function(){
    let out=previousDaily();
    out=out.replace(/<label>Hours of sleep<\/label><input[^>]*name="sleep"[^>]*>/,'');
    const qHead=out.indexOf('<h3>QUEST LOG</h3>');
    if(qHead>=0){const qStart=out.lastIndexOf('<section',qHead),qEnd=out.indexOf('</section>',qHead)+10;if(qStart>=0&&qEnd>qStart)out=out.slice(0,qStart)+questPanel()+out.slice(qEnd);}
    return out;
  };
  /* Keep selected date stable and save to that exact date; never advance the page. */
  window.dRec=function(){
    const date=$id('dailyDate')?.value||window.ccSelectedDailyDate||today();
    window.ccSelectedDailyDate=date;db.daily[date]??={};return db.daily[date];
  };
  window.saveDaily=function(){
    const date=$id('dailyDate')?.value||window.ccSelectedDailyDate||today();
    window.ccSelectedDailyDate=date;db.daily[date]??={};const d=db.daily[date];
    document.querySelectorAll('#view input[name],#view textarea[name]').forEach(x=>{if(x.name!=='date'&&!x.closest('#structuredQuestForm'))d[x.name]=x.value});
    d.schedule=[...document.querySelectorAll('#scheduleRows .row')].map(r=>({time:r.children[0].value,activity:r.children[1].value}));
    save();alert('Daily record saved for '+date+'.');
  };
  const oldBindQuests=window.bind;
  window.bind=function(){
    oldBindQuests();
    const f=$id('structuredQuestForm');
    if(f)f.onsubmit=e=>{
      e.preventDefault();const name=new FormData(f).get('name')?.toString().trim(),type=new FormData(f).get('type');
      if(!name)return;
      db.rpg.quests.push({id:crypto.randomUUID(),name,type,createdAt:today(),donePeriods:[]});
      log('New '+type.toLowerCase()+' quest registered: '+name+'. Try not to make it weird.','QUEST');
      save();render();
    };
  };
  /* A reliable book form and a compact finished-book card. */
  window.addBook=function(){
    const p=document.createElement('section');p.className='panel s12';
    p.innerHTML='<h3>ADD TO LIBRARY</h3><form id="bookForm">'+
      field('Book title','name')+field('Author','author')+field('Series / volume','series')+
      field('Current page','pages','0','number')+field('Total pages','total','','number')+
      '<label>Genre(s) — separate with commas</label><input name="genres" placeholder="Fantasy, LitRPG, Horror">'+
      '<label>Shelf</label><select name="status">'+['Want to Read','Currently Reading','Finished','DNF'].map(x=>'<option>'+x+'</option>').join('')+'</select>'+
      field('Rating (1–5)','rating','')+'<label>Cover art</label><input type="file" name="photo" accept="image/*">'+area('Review / notes','review')+
      '<button class="btn gold" type="submit">Add book</button><button class="btn" type="button" onclick="render()">Cancel</button></form>';
    $id('view').prepend(p);
    $id('bookForm').onsubmit=e=>{
      e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;
      const fd=new FormData(f),o={};['name','author','series','pages','total','status','rating','review'].forEach(k=>o[k]=String(fd.get(k)||''));
      o.genres=String(fd.get('genres')||'').split(',').map(x=>x.trim()).filter(Boolean);
      o.pages=Number(o.pages)||0;o.total=Number(o.total)||0;o.finishedDate=o.status==='Finished'?today():'';
      const file=f.elements.photo.files?.[0];const done=()=>{db.books.push(o);save();check();render()};
      if(file){const reader=new FileReader();reader.onload=()=>{o.photo=reader.result;done()};reader.onerror=()=>alert('The cover image could not be read. Try again without it.');reader.readAsDataURL(file)}else done();
    };
  };
  const oldReadingPage=window.reading;
  window.reading=function(){
    let out=oldReadingPage();
    out=out.replace(/<label>Current page \/ total<\/label>[\s\S]*?<small>[^<]*<\/small>/g,(block)=>block);
    /* Hide page-tracking controls only on finished books; keep shelf/status and history. */
    const temp=document.createElement('div');temp.innerHTML=out;
    temp.querySelectorAll('.bookcard').forEach((card,i)=>{
      const b=db.books[i];if(!b||b.status!=='Finished')return;
      card.querySelectorAll('label,input, .chart, small').forEach(el=>{
        if(el.closest('select'))return;
        if(el.matches('label')&&el.textContent.includes('Reading status'))return;
        if(el.matches('input')||el.matches('.chart')||el.matches('small')||el.textContent.includes('Current page'))el.remove();
      });
    });
    return temp.innerHTML;
  };
  /* Symptom history and profile are read-only until the user presses Edit. */
  window.petDetail=function(i){
    const p=db.dogs[i];if(!p)return;const view=$id('view');
    const profile='<div class="rpgitem"><div class="row between"><b>'+esc2(p.name)+' · PROFILE</b><button class="btn" type="button" onclick="togglePetEditor()">Edit profile</button></div><p>'+esc2(p.breed||'Breed not set')+' · '+esc2(p.age||'Age not set')+'</p><p>Weight: '+esc2(p.weight||'—')+'</p><p>Medications: '+esc2(p.medications||'—')+'</p><p>Allergies: '+esc2(p.allergies||'—')+'</p><p>'+esc2(p.notes||'No notes recorded.')+'</p><form id="petEdit" hidden><label>Name</label><input name="name" value="'+esc2(p.name)+'"><label>Breed</label><input name="breed" value="'+esc2(p.breed||'')+'"><label>Birthday / age</label><input name="age" value="'+esc2(p.age||'')+'"><label>Weight</label><input name="weight" value="'+esc2(p.weight||'')+'"><label>Medications</label><input name="medications" value="'+esc2(p.medications||'')+'"><label>Allergies</label><input name="allergies" value="'+esc2(p.allergies||'')+'"><label>Notes</label><textarea name="notes">'+esc2(p.notes||'')+'</textarea><button class="btn gold">Save profile</button><button class="btn" type="button" onclick="togglePetEditor()">Cancel</button></form></div>';
    const history=(p.symptoms||[]).map((x,j)=>'<div class="rpgitem"><div class="row between"><b>'+esc2(x.symptom)+'</b><span class="tag">'+esc2(x.date||'No date')+' · '+esc2(x.severity||'')+'</span></div><p>'+esc2(x.kind||'')+' · '+esc2(x.duration||'')+'</p><p>'+esc2(x.notes||'')+'</p><button class="btn" type="button" onclick="editPetSymptom('+i+','+j+')">Edit entry</button><form id="petSym'+j+'" hidden><label>Symptom</label><input name="symptom" value="'+esc2(x.symptom)+'"><label>Date</label><input name="date" type="date" value="'+esc2(x.date||'')+'"><label>Severity</label><select name="severity">'+['Mild','Moderate','Severe','Emergency'].map(v=>'<option '+(x.severity===v?'selected':'')+'>'+v+'</option>').join('')+'</select><label>Type</label><input name="kind" value="'+esc2(x.kind||'')+'"><label>Duration</label><input name="duration" value="'+esc2(x.duration||'')+'"><label>Notes</label><textarea name="notes">'+esc2(x.notes||'')+'</textarea><button class="btn gold" type="button" onclick="savePetSymptom('+i+','+j+')">Save entry</button><button class="btn danger" type="button" onclick="deletePetSymptom('+i+','+j+')">Delete entry</button></form></div>').join('')||'<p class="rpgmuted">No symptom history yet.</p>';
    view.innerHTML='<div class="row" style="margin:8px 0"><button class="btn" onclick="go(\'dogs\')">← BACK TO PETS</button></div><div class="grid">'+panel('PET PROFILE',profile,'s12')+panel('SYMPTOM HISTORY',history,'s12')+panel('LOG A SYMPTOM','<form id="newPetSym"><label>Symptom / issue</label><input name="symptom" required><label>Date</label><input name="date" type="date" value="'+today()+'"><label>Severity</label><select name="severity"><option>Mild</option><option>Moderate</option><option>Severe</option><option>Emergency</option></select><label>Type</label><select name="kind"><option>New symptom</option><option>Recurring issue</option><option>Resolved</option><option>Other observation</option></select><label>Duration / frequency</label><input name="duration"><label>Notes / possible triggers</label><textarea name="notes"></textarea><button class="btn gold">Save symptom</button></form>','s12')+'</div>';
    $id('petEdit').onsubmit=e=>{e.preventDefault();Object.assign(p,Object.fromEntries(new FormData(e.currentTarget)));save();petDetail(i)};
    $id('newPetSym').onsubmit=e=>{e.preventDefault();p.symptoms??=[];p.symptoms.push(Object.fromEntries(new FormData(e.currentTarget)));save();petDetail(i)};
  };
  window.togglePetEditor=function(){const f=$id('petEdit');if(f)f.hidden=!f.hidden};
  window.editPetSymptom=function(i,j){const f=$id('petSym'+j);if(f)f.hidden=!f.hidden};
  window.savePetSymptom=function(i,j){const f=$id('petSym'+j);if(!f)return;Object.assign(db.dogs[i].symptoms[j],Object.fromEntries(new FormData(f)));save();petDetail(i)};
  window.deletePetSymptom=function(i,j){if(confirm('Delete this symptom entry?')){db.dogs[i].symptoms.splice(j,1);save();petDetail(i)}};
  /* Distinct neon dungeon tiles and wrap-safe labels. */
  style.textContent += `
    .modulegrid button{min-width:0;min-height:112px;height:auto;padding:14px 10px;white-space:normal;overflow:visible}
    .modulegrid button b{display:block;white-space:normal;overflow-wrap:anywhere;line-height:1.25;text-align:center}
    .modulegrid button[onclick*="dungeon"]{background:linear-gradient(145deg,#3a164d,#15172e 75%);border-color:#ff3da6}
    .modulegrid button[onclick*="trophies"]{background:linear-gradient(145deg,#46320b,#171b2b 75%);border-color:#eaff00}
    .modulegrid button[onclick*="achievements"]{background:linear-gradient(145deg,#0c3b49,#111a2b 75%);border-color:#00eaff}
    .modulegrid button[onclick*="systemLog"]{background:linear-gradient(145deg,#48202c,#111a2b 75%);border-color:#ff6b8a}
    .modulegrid button[onclick*="recaps"]{background:linear-gradient(145deg,#153d2b,#111a2b 75%);border-color:#b7ff00}
    .quest-row{margin:8px 0}.rpgitem summary{cursor:pointer;padding:4px}
    #petEdit[hidden],form[hidden]{display:none!important}
  `;
  /* Gold labels were duplicated by the first patch; replace the label once, in place. */
  const dailyBeforeFix=window.daily;
  window.daily=function(){
    let out=dailyBeforeFix();
    out=out.replace(/<label>Gold gained<\/label>/g,'<label>Gold gained ($)</label>').replace(/<label>Gold spent<\/label>/g,'<label>Gold spent ($)</label>');
    out=out.replace(/<label>Gold gained \(\$\)<\/label><label>Gold gained \(\$\)<\/label>/g,'<label>Gold gained ($)</label>');
    out=out.replace(/<label>Gold spent \(\$\)<\/label><label>Gold spent \(\$\)<\/label>/g,'<label>Gold spent ($)</label>');
    return out;
  };
  /* Keep the lexical function bindings used by the original single-file renderer aligned. */
  home=window.home;daily=window.daily;reading=window.reading;addBook=window.addBook;dRec=window.dRec;saveDaily=window.saveDaily;bind=window.bind;petDetail=window.petDetail;

})();