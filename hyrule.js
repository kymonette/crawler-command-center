/* Hyrule Adventure System — independent Zelda progression layer */
(function(){
  const defaults={orbEvents:[],quests:[],dungeons:[],medals:[],unlocks:{},notes:""};
  db.hyrule=Object.assign({},defaults,db.hyrule||{});
  Object.keys(defaults).forEach(k=>{if(db.hyrule[k]===undefined)db.hyrule[k]=defaults[k]});
  const $=id=>document.getElementById(id);
  const escH=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const orbTotal=()=>db.hyrule.orbEvents.reduce((n,x)=>n+(+x.amount||0),0);
  const heroLevel=()=>Math.floor(orbTotal()/100)+1;
  const nextLevel=()=>orbTotal()%100;
  function award(amount,reason){
    amount=Math.max(0,Math.min(500,+amount||0));if(!amount)return;
    db.hyrule.orbEvents.unshift({id:crypto.randomUUID(),amount,reason:String(reason||'Adventure progress').trim(),date:new Date().toISOString()});
    save();
  }
  function questDone(id){
    const q=db.hyrule.quests.find(x=>x.id===id);if(!q||q.done)return;
    q.done=true;q.completedAt=new Date().toISOString();award(q.reward||10,'Quest complete: '+q.name);render();
  }
  function addQuest(e){
    e.preventDefault();const f=e.target,name=f.name.value.trim();if(!name)return;
    db.hyrule.quests.unshift({id:crypto.randomUUID(),name,region:f.region.value.trim(),reward:Math.max(0,Math.min(100,+f.reward.value||10)),done:false,createdAt:new Date().toISOString()});
    save();render();
  }
  function addDungeon(e){
    e.preventDefault();const f=e.target,name=f.name.value.trim();if(!name)return;
    db.hyrule.dungeons.unshift({id:crypto.randomUUID(),name,region:f.region.value.trim(),boss:f.boss.value.trim(),notes:f.notes.value.trim(),cleared:false,createdAt:new Date().toISOString()});
    save();render();
  }
  function clearDungeon(id){
    const d=db.hyrule.dungeons.find(x=>x.id===id);if(!d||d.cleared)return;
    d.cleared=true;d.clearedAt=new Date().toISOString();
    db.hyrule.medals.unshift({id:crypto.randomUUID(),name:d.name,region:d.region,date:d.clearedAt});
    award(50,'Dungeon cleared: '+d.name);render();
  }
  function heroStatus(){
    const done=db.hyrule.quests.filter(q=>q.done).length,open=db.hyrule.quests.filter(q=>!q.done).length;
    const cleared=db.hyrule.dungeons.filter(d=>d.cleared).length;
    return '<section class="panel s12 hyrule-status"><div class="hyrule-status-head"><div><div class="eyebrow">HYRULE ADVENTURE RECORD</div><h2>HERO LEVEL '+heroLevel()+'</h2><p class="muted">'+orbTotal().toLocaleString()+' SPIRIT ORBS EARNED</p></div><div class="hyrule-triforce">△</div></div><div class="hyrule-orbbar"><span style="width:'+nextLevel()+'%"></span></div><div class="row between"><small class="muted">'+nextLevel()+' / 100 to next level</small><small class="muted">'+done+' quests complete · '+open+' active · '+cleared+' dungeons cleared</small></div></section>';
  }
  function dashboard(){
    const original=window.home();
    const recent=db.hyrule.orbEvents.slice(0,3).map(x=>'<div class="stat"><span>'+escH(x.reason)+'</span><b>+'+x.amount+' orbs</b></div>').join('')||'<p class="muted">Your adventure begins here.</p>';
    return heroStatus()+'<div class="grid">'+
      '<section class="panel s6"><h3>ACTIVE ADVENTURE QUESTS</h3>'+db.hyrule.quests.filter(q=>!q.done).slice(0,4).map(q=>'<div class="stat"><span>'+escH(q.name)+'</span><b>'+q.reward+' ◈</b></div>').join('')+'<button class="btn" onclick="go(\'hyruleQuests\')">Open quest log</button></section>'+
      '<section class="panel s6"><h3>RECENT SPIRIT ORBS</h3>'+recent+'</section></div>'+original;
  }
  function questsPage(){
    return '<div class="grid"><section class="panel s6"><h3>ADD A SIDE QUEST</h3><form id="hyruleQuestForm"><label>Quest name</label><input name="name" required maxlength="90" placeholder="e.g. Take a proper lunch break"><label>Region / category</label><input name="region" placeholder="Village, home, work..."><label>Spirit Orb reward</label><input name="reward" type="number" min="0" max="100" value="10"><button class="btn gold">Add quest</button></form></section><section class="panel s6"><h3>QUEST REWARDS</h3><p class="muted">Complete everyday tasks and earn Spirit Orbs. Rewards are motivation, not a score of your worth.</p><div class="stat"><span>Quick quest</span><b>10 orbs</b></div><div class="stat"><span>Big quest</span><b>25 orbs</b></div><div class="stat"><span>Major milestone</span><b>50 orbs</b></div></section><section class="panel s12"><h3>ADVENTURE LOG</h3>'+db.hyrule.quests.map(q=>'<div class="hyrule-item"><div><b>'+escH(q.name)+'</b><small>'+escH(q.region||'Hyrule')+' · '+(q.done?'COMPLETED':'ACTIVE')+'</small></div><div class="row">'+(q.done?'<span class="tag">+'+q.reward+' ◈</span>':'<button class="btn gold" onclick="hyruleCompleteQuest(\''+q.id+'\')">Complete · +'+q.reward+' ◈</button>')+'<button class="btn danger" onclick="hyruleDeleteQuest(\''+q.id+'\')">×</button></div></div>').join('')||'<p class="muted">No quests yet. Add the first one above.</p>'+'</section></div>';
  }
  function dungeonsPage(){
    return '<div class="grid"><section class="panel s6"><h3>REGISTER A DUNGEON</h3><form id="hyruleDungeonForm"><label>Dungeon / challenge</label><input name="name" required placeholder="Name your challenge"><label>Region</label><input name="region" placeholder="Hyrule Field, home, work..."><label>Boss / final milestone</label><input name="boss" placeholder="Optional"><label>Notes / objectives</label><textarea name="notes" placeholder="What needs to happen before this is cleared?"></textarea><button class="btn gold">Register dungeon</button></form></section><section class="panel s6"><h3>MEDALS OF HONOR</h3>'+db.hyrule.medals.map(m=>'<div class="hyrule-item"><div><b>✧ '+escH(m.name)+'</b><small>'+escH(m.region||'Hyrule')+' · '+new Date(m.date).toLocaleDateString()+'</small></div><span class="tag">CLEARED</span></div>').join('')||'<p class="muted">Your medal case is waiting for its first victory.</p>'+'</section><section class="panel s12"><h3>DUNGEON JOURNAL</h3>'+db.hyrule.dungeons.map(d=>'<div class="hyrule-item"><div><b>'+escH(d.name)+'</b><small>'+escH(d.region||'Hyrule')+(d.boss?' · Final challenge: '+escH(d.boss):'')+'</small>'+(d.notes?'<p class="muted">'+escH(d.notes)+'</p>':'')+'</div>'+(d.cleared?'<span class="tag">CLEARED</span>':'<button class="btn gold" onclick="hyruleClearDungeon(\''+d.id+'\')">Clear dungeon · +50 ◈</button>')+'</div>').join('')||'<p class="muted">No dungeons registered yet.</p>'+'</section></div>';
  }
  function inventoryPage(){
    const earned=orbTotal(),spent=db.hyrule.orbEvents.filter(x=>x.amount<0).reduce((n,x)=>n-x.amount,0);
    return '<div class="grid">'+
      '<section class="panel s6"><h3>SPIRIT ORB COLLECTION</h3><div class="big">'+earned+'</div><p class="muted">Lifetime Spirit Orbs · Hero Level '+heroLevel()+'</p><div class="hyrule-orbbar"><span style="width:'+nextLevel()+'%"></span></div><p class="muted">'+(100-nextLevel())+' orbs until the next level.</p></section>'+
      '<section class="panel s6"><h3>LOG A MILESTONE</h3><form id="hyruleOrbForm"><label>What did you accomplish?</label><input name="reason" required placeholder="A real-world victory"><label>Spirit Orbs</label><input name="amount" type="number" min="1" max="500" value="10"><button class="btn gold">Collect Spirit Orbs</button></form></section>'+
      '<section class="panel s12"><h3>INVENTORY / REWARD HISTORY</h3>'+db.hyrule.orbEvents.map(x=>'<div class="stat"><span>'+escH(x.reason)+' <small class="muted">'+new Date(x.date).toLocaleDateString()+'</small></span><b>+'+x.amount+' ◈</b></div>').join('')||'<p class="muted">No Spirit Orbs collected yet.</p>'+'</section></div>';
  }
  function bindHyrule(){
    const q=$('hyruleQuestForm');if(q)q.onsubmit=addQuest;
    const d=$('hyruleDungeonForm');if(d)d.onsubmit=addDungeon;
    const o=$('hyruleOrbForm');if(o)o.onsubmit=e=>{e.preventDefault();award(+e.target.amount.value,e.target.reason.value);render()};
  }
  window.hyruleCompleteQuest=questDone;
  window.hyruleClearDungeon=clearDungeon;
  window.hyruleDeleteQuest=id=>{if(!confirm('Remove this quest?'))return;db.hyrule.quests=db.hyrule.quests.filter(q=>q.id!==id);save();render()};
  const pagesToAdd=[['hyruleQuests','⚔','Quest Log'],['hyruleDungeons','◇','Dungeons'],['hyruleInventory','◈','Spirit Orbs']];
  pagesToAdd.forEach(p=>{if(!pages.some(x=>x[0]===p[0]))pages.push(p)});
  window.hyruleQuests=questsPage;window.hyruleDungeons=dungeonsPage;window.hyruleInventory=inventoryPage;
  const oldRender=window.render;
  window.render=function(){
    if(page==='hyruleQuests'||page==='hyruleDungeons'||page==='hyruleInventory'){
      $('view').innerHTML='<div class="row" style="margin:8px 0 14px"><button class="btn" onclick="go(\'home\')">← HERO DASHBOARD</button></div>'+({hyruleQuests:questsPage, hyruleDungeons:dungeonsPage, hyruleInventory:inventoryPage}[page])();
      bindHyrule();return;
    }
    oldRender();
  };
  const oldHome=window.home;
  window.home=function(){return heroStatus()+oldHome()};
  const style=document.createElement('style');style.textContent=`
  .hyrule-status{border-color:#c8a85b;background:linear-gradient(135deg,#234a49,#112b36 65%,#172b35);box-shadow:inset 0 0 28px #07151c99,0 0 18px #d6b35b20}
  .hyrule-status-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.hyrule-status h2{font-size:24px;margin:3px 0}.hyrule-triforce{font-size:56px;color:#e8c56a;text-shadow:0 0 18px #e8c56a55;transform:scaleX(1.15)}
  .hyrule-orbbar{height:10px;background:#071923;border:1px solid #688d80;margin:10px 0 6px;overflow:hidden}.hyrule-orbbar span{display:block;height:100%;background:linear-gradient(90deg,#4eaaa0,#9acb77,#e8c56a);box-shadow:0 0 12px #9acb7766}
  .hyrule-item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #456b66}.hyrule-item>div:first-child{min-width:0}.hyrule-item small{display:block;color:var(--muted);font:10px system-ui;margin-top:4px}.hyrule-item .row{flex-wrap:nowrap}.hyrule-item .btn{padding:7px 9px}
  `;document.head.append(style);
  const originalHeader=window.header;
  if(typeof originalHeader==='function'){originalHeader();go('home')}
})();
