/* Independent push reminders for this planner only. */
(() => {
  const PROJECT_URL = "https://yvoaqoldfqknwrrelswh.supabase.co";
  const PUBLIC_KEY = "BD4e_I-ch8sZrq9iZnuldCyHJFjNeT51J2rdrD20gyZ44AJG6eydsXDMwQxc8OPkdyKz-2Z2YSyJ73soCBOJLaI";
  const PLANNER = location.pathname.toLowerCase().includes("hyrule-command-center") ? "hyrule" : "dcc";
  const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  const b64 = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let initialized = false, currentUser = null, client = null;

  async function getAuth() {
    if (window.partnerInboxGetSession) {
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
    const accent=isH?"#e8c56a":"#00eaff";
    const html=`<section class="panel s12 planner-notify-panel"><h3>${title}</h3>
      <p class="muted">Receive reminders on this phone, even when the planner is closed. Notifications are private to this planner and signed-in account.</p>
      <div id="plannerNotifyStatus" class="planner-notify-status" hidden></div>
      <div class="row" style="margin:10px 0"><button class="btn gold" type="button" onclick="plannerEnablePush()">Enable phone notifications</button><button class="btn" type="button" onclick="plannerRefreshReminders()">Refresh reminders</button></div>
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
    setTimeout(()=>initPanel(),0);
    return html;
  }
  async function initPanel(){
    if(initialized)return; initialized=true;
    try { await getAuth(); if(!currentUser){status("Sign in through Partner Inbox on this planner first. Notifications are tied to that account.",true);document.getElementById("plannerReminderList").innerHTML='<p class="muted">Sign in to manage reminders.</p>';return;} await loadReminders(); }
    catch(e){status(e.message||"Could not load notification settings.",true);}
  }
  async function loadReminders(){
    const {client,user}=await getAuth();if(!user){status("Sign in through Partner Inbox first.",true);return;}
    const {data,error}=await client.from("planner_reminders").select("id,title,body,scheduled_at,timezone,repeat_rule,enabled,next_run_at").eq("user_id",user.id).eq("planner",PLANNER).order("next_run_at",{ascending:true});
    if(error)throw error;
    const el=document.getElementById("plannerReminderList");if(!el)return;
    if(!data?.length){el.innerHTML='<p class="muted">No reminders yet.</p>';return;}
    el.innerHTML=data.map(r=>`<div class="planner-reminder"><div><b>${esc(r.title)}</b><div class="muted">${esc(r.body||"")}</div><small>${new Date(r.next_run_at||r.scheduled_at).toLocaleString()} · ${r.repeat_rule==="none"?"One time":r.repeat_rule}</small></div><button class="btn danger" type="button" onclick="plannerDeleteReminder('${r.id}')">Delete</button></div>`).join("");
  }
  async function enablePush(){
    try{
      if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))throw new Error("This browser does not support background push notifications. Install the planner from Chrome and try again.");
      const {client,user}=await getAuth();if(!user)throw new Error("Sign in through Partner Inbox on this planner first.");
      const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error("Notification permission was not granted. Allow it in Android app settings.");
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(PUBLIC_KEY)});
      const j=sub.toJSON();
      const {error}=await client.from("planner_push_subscriptions").upsert({user_id:user.id,planner:PLANNER,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth_secret:j.keys.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:"user_id,planner,endpoint"});
      if(error)throw error;
      status("Phone notifications are enabled for this planner on this device.");
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
  window.plannerEnablePush=enablePush;
  window.plannerSaveReminder=saveReminder;
  window.plannerRefreshReminders=async()=>{try{await loadReminders();status("Reminders refreshed.");}catch(e){status(e.message,true);}};
  window.plannerDeleteReminder=deleteReminder;
  const style=document.createElement("style");style.textContent=`
    .planner-notify-panel{border-color:${accent};}
    .planner-notify-status{padding:10px;margin:8px 0;background:#15332e;color:#baf6dc;border:1px solid #368b72;border-radius:8px;font:12px system-ui}
    .planner-notify-status.error{background:#3b1b27;color:#ffd2dc;border-color:#9b465f}
    .planner-reminder-form{display:grid;gap:5px;max-width:620px;margin-top:12px}
    .planner-reminder-list{display:grid;gap:8px}
    .planner-reminder{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px;background:#080e19;border:1px solid ${accent}55;border-radius:8px;font:12px system-ui}
    .planner-reminder small{display:block;color:#a6b5c9;margin-top:4px}
  `;document.head.appendChild(style);
})();