/* Independent push reminders for this planner only. */
(() => {
  const PROJECT_URL = "https://yvoaqoldfqknwrrelswh.supabase.co";
  const PUBLIC_KEY = "BD4e_I-ch8sZrq9iZnuldCyHJFjNeT51J2rdrD20gyZ44AJG6eydsXDMwQxc8OPkdyKz-2Z2YSyJ73soCBOJLaI";
  const PLANNER = location.pathname.toLowerCase().includes("hyrule-command-center") ? "hyrule" : "dcc";
  const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  const accent = PLANNER === "hyrule" ? "#e8c56a" : "#00eaff";
  const b64 = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let initialized = false, currentUser = null, client = null;

  async function getAuth() {
    if (window.partnerInboxGetSession) {
      for (let i=0; i<40 && !window.supabase?.createClient; i++) await new Promise(resolve=>setTimeout(resolve,150));
      const session = await window.partnerInboxGetSession();
      client = session.client; currentUser = session.user; return session;
    }
    if (window.supabase?.createClient) {
      client ||= window.supabase.createClient(PROJECT_URL,"sb_publishable_Y-IJuTcDrlUuUnXB-Onvng_ayim_Xd-",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const {data,error}=await client.auth.getSession(); if(error)throw error;
      currentUser=data.session?.user||null; return {client,user:currentUser};
    }
    throw new Error("Sign-in service is still loading. Refresh and try again.");
  }
  function status(msg,error=false){const el=document.getElementById("plannerNotifyStatus");if(el){el.textContent=msg;el.className="planner-notify-status"+(error?" error":"");el.hidden=false;}}
  function panel(){
    const isH=PLANNER==="hyrule";
    const title=isH?"ROYAL MESSENGER":"SYSTEM NOTIFICATIONS";
    const html=`<section class="panel s12 planner-notify-panel"><h3>${title}</h3>
      <p class="muted">Receive reminders on this phone, even when the planner is closed. Notifications are private to this planner and signed-in account.</p>
      <div id="plannerNotifyStatus" class="planner-notify-status" hidden></div>
      <div class="row" style="margin:10px 0"><button class="btn gold" type="button" onclick="plannerEnablePush()">Enable phone notifications</button><button class="btn" type="button" onclick="plannerRefreshReminders()">Refresh reminders</button></div>
      <div class="planner-auto-panel">
        <h3>${isH ? "ROYAL ROUTINES" : "SYSTEM-ISSUED PROMPTS"}</h3>
        <p class="muted">${isH ? "Choose when the kingdom sends gentle reminders." : "Choose when the System sends its daily directives."} Each prompt can be switched on or off.</p>
        <form id="plannerAutoPrefsForm" onsubmit="plannerSaveAutoPrefs(event)">
          ${[
            ["morning",isH?"DAWN DISPATCH":"MORNING SYSTEM BRIEFING", "08:00"],
            ["habits",isH?"HABIT TRAINING REMINDER":"DAILY HABIT CHECK", "18:00"],
            ["evening",isH?"EVENING AT THE CASTLE":"END-OF-DAY CRAWLER CHECK", "21:00"],
            ["weekly",isH?"WEEKLY HERO'S JOURNAL":"WEEKLY CRAWLER DEBRIEF", "18:00"]
          ].map(([key,title,time])=>`<div class="planner-auto-row"><label><input type="checkbox" name="enabled_${key}"> <b>${title}</b></label><input type="time" name="time_${key}" value="${time}" aria-label="${title} time"></div>`).join("")}
          <label class="planner-auto-day">Weekly recap day <select name="weekly_day"><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label>
          <button class="btn gold" type="submit">Save automatic notifications</button>
        </form>
        <p class="muted">${isH ? "New letters from your companion will also trigger a Royal Messenger alert." : "New messages from your companion will also trigger a System notification."}</p>
      </div>
      <form id="plannerReminderForm" class="planner-reminder-form" onsubmit="plannerSaveReminder(event)">
        <label>Reminder title</label><input name="title" maxlength="120" required placeholder="e.g. Take a break">
        <label>Message (optional)</label><input name="body" maxlength="240" placeholder="A little nudge from your planner">
        <label>Date and time</label><input name="when" type="datetime-local" required>
        <label>Repeat</label><select name="repeat_rule"><option value="none">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
        <button class="btn gold" type="submit">Save reminder</button>
      </form>
      <h3 style="margin-top:18px">YOUR REMINDERS</h3><div id="plannerReminderList" class="planner-reminder-list"><p class="muted">Loading reminders…</p></div>
      <p class="muted">Phone notification permission is controlled by Android. If you previously blocked it, allow notifications for this installed app in Android settings.</p>
    </section>`;
    setTimeout(()=>{initialized=false;initPanel();},0);
    return html;
  }
  async function initPanel(){
    if(initialized)return; initialized=true;
    try { await getAuth(); if(!currentUser){status("Sign in through Partner Inbox on this planner first. Notifications are tied to that account.",true);document.getElementById("plannerReminderList").innerHTML='<p class="muted">Sign in to manage reminders.</p>';return;} await syncExistingPushSubscription(); await loadReminders(); await loadAutoPrefs(); }
    catch(e){status(e.message||"Could not load notification settings.",true);}
  }
  const AUTO_CATEGORIES = ["morning","habits","evening","weekly"];
  const AUTO_DEFAULTS = {morning:"08:00",habits:"18:00",evening:"21:00",weekly:"18:00"};
  async function loadAutoPrefs(){
    const {client,user}=await getAuth(); if(!user)return;
    const {data,error}=await client.from("planner_notification_preferences").select("category,enabled,local_time,weekly_day").eq("user_id",user.id).eq("planner",PLANNER);
    if(error)throw error;
    const form=document.getElementById("plannerAutoPrefsForm"); if(!form)return;
    for(const category of AUTO_CATEGORIES){
      const row=(data||[]).find(x=>x.category===category);
      form.elements["enabled_"+category].checked=!!row?.enabled;
      form.elements["time_"+category].value=row?.local_time?.slice(0,5)||AUTO_DEFAULTS[category];
      if(category==="weekly" && row)form.elements.weekly_day.value=String(row.weekly_day??0);
    }
  }
  async function saveAutoPrefs(event){
    event.preventDefault();
    try{
      const {client,user}=await getAuth();if(!user)throw new Error("Sign in through Partner Inbox first.");
      const form=event.currentTarget;
      const weeklyDay=Number(form.elements.weekly_day.value||0);
      const rows=AUTO_CATEGORIES.map(category=>({
        user_id:user.id,planner:PLANNER,category,
        enabled:form.elements["enabled_"+category].checked,
        local_time:form.elements["time_"+category].value||AUTO_DEFAULTS[category],
        timezone:TIMEZONE,weekly_day:weeklyDay,updated_at:new Date().toISOString()
      }));
      const {error}=await client.from("planner_notification_preferences").upsert(rows,{onConflict:"user_id,planner,category"});
      if(error)throw error;
      status(PLANNER==="hyrule"?"Royal routines saved. The kingdom will send alerts at your chosen times.":"System prompts saved. The System will report at your chosen times.");
    }catch(e){status(e.message||"Could not save automatic notifications.",true);}
  }
  async function loadReminders(){
    const {client,user}=await getAuth();if(!user){status("Sign in through Partner Inbox first.",true);return;}
    const {data,error}=await client.from("planner_reminders").select("id,title,body,scheduled_at,timezone,repeat_rule,enabled,next_run_at").eq("user_id",user.id).eq("planner",PLANNER).order("next_run_at",{ascending:true});
    if(error)throw error;
    const el=document.getElementById("plannerReminderList");if(!el)return;
    if(!data?.length){el.innerHTML='<p class="muted">No reminders yet.</p>';return;}
    el.innerHTML=data.map(r=>`<div class="planner-reminder"><div><b>${esc(r.title)}</b><div class="muted">${esc(r.body||"")}</div><small>${new Date(r.next_run_at||r.scheduled_at).toLocaleString()} · ${r.repeat_rule==="none"?"One time":r.repeat_rule}</small></div><button class="btn danger" type="button" onclick="plannerDeleteReminder('${r.id}')">Delete</button></div>`).join("");
  }
  async function registerPushSubscription(client,user,reg,{repairStale=true}={}){
    let sub=await reg.pushManager.getSubscription();
    if(sub && repairStale){
      const current=sub.toJSON();
      // The dispatcher removes endpoints rejected by the push service (404/410).
      // If the browser still holds that endpoint, replace it instead of re-registering it.
      const {data:known,error:lookupError}=await client.from("planner_push_subscriptions").select("id").eq("user_id",user.id).eq("planner",PLANNER).eq("endpoint",current.endpoint).maybeSingle();
      if(lookupError)throw lookupError;
      if(!known){
        await sub.unsubscribe();
        sub=null;
      }
    }
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(PUBLIC_KEY)});
    const j=sub.toJSON();
    if(!j.endpoint||!j.keys?.p256dh||!j.keys?.auth)throw new Error("The browser created an incomplete push subscription. Please try again.");
    const {data,error}=await client.from("planner_push_subscriptions").upsert({user_id:user.id,planner:PLANNER,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth_secret:j.keys.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:"user_id,planner,endpoint"}).select("id").single();
    if(error)throw error;
    if(!data?.id)throw new Error("The push subscription was not confirmed by the server.");
    return data.id;
  }
  async function syncExistingPushSubscription(){
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)||Notification.permission!=="granted")return false;
    const {client,user}=await getAuth();if(!user)return false;
    const reg=await navigator.serviceWorker.ready;
    await registerPushSubscription(client,user,reg);
    return true;
  }
  async function enablePush(){
    try{
      if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))throw new Error("This browser does not support background push notifications. Install the planner from Chrome and try again.");
      const {client,user}=await getAuth();if(!user)throw new Error("Sign in through Partner Inbox on this planner first.");
      const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error("Notification permission was not granted. Allow it in Android app settings.");
      const reg=await navigator.serviceWorker.ready;
      await registerPushSubscription(client,user,reg);
      status("Phone notification registration was confirmed. The next scheduled alert will verify delivery.");
    }catch(e){status(e.message||"Could not enable notifications.",true);}
  }
  async function saveReminder(event){
    event.preventDefault();const form=event.currentTarget;
    try{
      const {client,user}=await getAuth();if(!user)throw new Error("Sign in through Partner Inbox on this planner first.");
      if(Notification.permission!=="granted")throw new Error("Enable phone notifications first.");
      const value=form.elements.when.value;if(!value)throw new Error("Choose a date and time.");
      const when=new Date(value);if(Number.isNaN(when.getTime())||when<=new Date())throw new Error("Choose a future date and time.");
      const rule=form.elements.repeat_rule.value;
      const row={user_id:user.id,planner:PLANNER,title:form.elements.title.value.trim(),body:form.elements.body.value.trim(),scheduled_at:when.toISOString(),next_run_at:when.toISOString(),timezone:TIMEZONE,repeat_rule:rule,enabled:true};
      const {error}=await client.from("planner_reminders").insert(row);if(error)throw error;
      form.reset();status("Reminder saved. It will be sent at the scheduled time.");await loadReminders();
    }catch(e){status(e.message||"Could not save reminder.",true);}
  }
  async function deleteReminder(id){
    try{const {client,user}=await getAuth();if(!user)throw new Error("Sign in first.");const {error}=await client.from("planner_reminders").delete().eq("id",id).eq("user_id",user.id).eq("planner",PLANNER);if(error)throw error;status("Reminder deleted.");await loadReminders();}
    catch(e){status(e.message||"Could not delete reminder.",true);}
  }
  window.plannerNotificationsPanel=panel;
  window.plannerSaveAutoPrefs=saveAutoPrefs;
  window.plannerEnablePush=enablePush;
  window.plannerSaveReminder=saveReminder;
  window.plannerRefreshReminders=async()=>{try{await loadReminders();status("Reminders refreshed.");}catch(e){status(e.message,true);}};
  window.plannerDeleteReminder=deleteReminder;
  const style=document.createElement("style");style.textContent=`
    .planner-notify-panel{border-color:${accent};}
    .planner-notify-status{padding:10px;margin:8px 0;background:#15332e;color:#baf6dc;border:1px solid #368b72;border-radius:8px;font:12px system-ui}
    .planner-notify-status.error{background:#3b1b27;color:#ffd2dc;border-color:#9b465f}
    .planner-reminder-form{display:grid;gap:5px;max-width:620px;margin-top:12px}
    .planner-auto-panel{margin:14px 0;padding:13px;border:1px solid #00eaff55;border-radius:10px;background:#080e19}
    .planner-auto-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #34485e}
    .planner-auto-row label{display:flex;align-items:center;gap:8px;flex:1;font-size:12px}
    .planner-auto-row input[type=time],.planner-auto-day select{background:#111b2b;color:#fff;border:1px solid #52647b;border-radius:6px;padding:7px}
    .planner-auto-day{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0;font-size:12px}
    .planner-reminder-list{display:grid;gap:8px}
    .planner-reminder{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;background:#080e19;border:1px solid ${accent}55;border-radius:8px;font:12px system-ui}
    .planner-reminder small{display:block;color:#a6b5c9;margin-top:4px}
  `;document.head.appendChild(style);
})();