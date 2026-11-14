/* Shared Partner Inbox — only the explicitly shared message table is accessed. */
(function () {
  const SUPABASE_URL = "https://yvoaqoldfqknwrrelswh.supabase.co";
  const SUPABASE_KEY = "sb_publishable_Y-IJuTcDrlUuUnXB-Onvng_ayim_Xd-";
  const PAIR_ID = "d4c9b4a2-0e6a-492d-9b85-359bae9e21c4";
  const ALLOWED_EMAILS = ["ky.monette@gmail.com", "sroban93@yahoo.com"];
  const TYPES = [
    ["message", "Just a message"],
    ["love_note", "Love note"],
    ["appreciation", "Appreciation"],
    ["check_in", "How I'm doing"],
    ["need_right_now", "What I need right now"],
    ["memory", "A shared memory"]
  ];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const fmt = s => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString([], {
      month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit"
    });
  };
  const state = { client:null, user:null, messages:[], loading:false, error:"", note:"", unread:0 };
  const lastReadKey = () => "partner-inbox-last-read-" + (state.user?.id || "guest");
  let initialized = false;

  function styles() {
    if (document.getElementById("partnerInboxStyles")) return;
    const style = document.createElement("style");
    style.id = "partnerInboxStyles";
    style.textContent = `
      .partner-inbox-tile{position:relative!important;overflow:hidden!important}
      .partner-inbox-tile i{font-style:normal}
      .partner-inbox-count{position:absolute;right:9px;top:8px;min-width:21px;padding:3px 6px;border-radius:20px;background:#ff3d91;color:#fff;font:800 10px system-ui;box-shadow:0 0 12px #ff3d91}
      .partner-page{display:grid;gap:14px}
      .partner-hero{padding:17px;border:1px solid var(--partner-accent,#35e7ff);border-radius:14px;background:linear-gradient(145deg,#151d32,#0a101e);box-shadow:inset 0 0 24px #35e7ff12,0 0 14px #35e7ff15}
      .partner-hero h2{margin:0 0 5px;font-size:clamp(20px,4vw,28px);color:var(--partner-accent,#7eeeff)}
      .partner-hero p{margin:0;color:#bdc9d9}
      .partner-auth,.partner-compose,.partner-message{padding:14px;border:1px solid #34485e;border-radius:12px;background:#0d1523;color:#f4f6fb}
      .partner-auth label,.partner-compose label{display:block;margin:9px 0 5px;color:#cbd5e1;font-size:12px}
      .partner-auth input,.partner-compose input,.partner-compose textarea,.partner-compose select{box-sizing:border-box;width:100%;padding:11px;border:1px solid #52647b;border-radius:8px;background:#080e19;color:#fff;font:inherit}
      .partner-compose textarea{min-height:95px;resize:vertical}
      .partner-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .partner-status{padding:10px 12px;border-radius:9px;background:#14253a;color:#b8d7ee;font-size:13px}
      .partner-status.error{background:#3a1823;color:#ffd2dc}
      .partner-thread{display:grid;gap:10px}
      .partner-message{max-width:88%;border-color:#3d526a}
      .partner-message.outgoing{justify-self:end;background:#172b3b;border-color:var(--partner-accent,#35e7ff)}
      .partner-message.incoming{justify-self:start}
      .partner-message-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:7px;color:#9fb4c8;font-size:11px}
      .partner-message-type{color:var(--partner-accent,#7eeeff);font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      .partner-message-body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
      .partner-empty{padding:22px;text-align:center;border:1px dashed #52647b;border-radius:12px;color:#aebdce}
      .partner-small{font-size:11px;color:#91a3b8}
      .partner-page .btn{cursor:pointer}
      body[data-page="partnerInbox"] .partner-inbox-tile{outline:2px solid var(--partner-accent,#35e7ff)}
      @media(max-width:560px){.partner-message{max-width:96%}}
    `;
    document.head.appendChild(style);
  }

  function getClient() {
    if (state.client) return state.client;
    if (!window.supabase?.createClient) return null;
    state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    return state.client;
  }

  function tile() {
    const isHyrule = location.pathname.toLowerCase().includes("hyrule-command-center");
    const title = isHyrule ? "PARTNER MAIL" : "PARTNER INBOX";
    const subtitle = isHyrule ? "A MESSAGE FROM YOUR COMPANION" : "A MESSAGE FROM YOUR PARTY";
    return `<button class="module partner-inbox-tile ${isHyrule ? "hyrule-module" : ""}" data-id="partnerInbox" onclick="go('partnerInbox')"><span class="partner-inbox-count" id="partnerInboxTileBadge">${state.unread || "✦"}</span><i>💌</i><b>${title}</b><small>${subtitle}</small></button>`;
  }

  function addTileToHome() {
    const previous = window.home;
    if (typeof previous !== "function" || previous.__partnerWrapped) return;
    const wrapped = function () {
      const html = previous.apply(this, arguments);
      if (html.includes("partner-inbox-tile")) return html;
      return html.replace(/(<div class="modulegrid">[\s\S]*?)(<\/div>\s*$)/, "$1" + tile() + "$2");
    };
    wrapped.__partnerWrapped = true;
    window.home = wrapped;
    try { home = wrapped; } catch (_) {}
  }

  function updateTileBadge() {
    const badge = document.getElementById("partnerInboxTileBadge");
    if (badge) badge.textContent = state.unread ? String(state.unread) : "✦";
    if (badge) badge.style.display = state.unread ? "inline-block" : "none";
  }

  function pageHtml() {
    const isHyrule = location.pathname.toLowerCase().includes("hyrule-command-center");
    document.documentElement.style.setProperty("--partner-accent", isHyrule ? "#e8c56a" : "#00eaff");
    const title = isHyrule ? "A LETTER FROM YOUR COMPANION" : "A MESSAGE FROM YOUR PARTY";
    const subtitle = isHyrule
      ? "A quiet corner of the kingdom for notes, check-ins, and memories shared between you."
      : "A quiet corner outside the dungeon noise for notes, check-ins, and memories shared between you.";
    if (!getClient()) return `<div class="partner-page"><section class="partner-hero"><h2>${title}</h2><p>${subtitle}</p></section><div class="partner-status error">The message service could not load. Check your connection and refresh the page.</div></div>`;
    if (!state.user) return `
      <div class="partner-page">
        <section class="partner-hero"><h2>${title}</h2><p>${subtitle}</p></section>
        <section class="partner-auth">
          <h3>Sign in to your shared inbox</h3>
          <p class="partner-small">Use the email address already connected to this Partner Inbox. We'll send you a one-time sign-in link.</p>
          <form onsubmit="window.partnerInboxSignIn(event)">
            <label for="partnerInboxEmail">Email address</label>
            <input id="partnerInboxEmail" type="email" autocomplete="email" placeholder="you@example.com" required>
            <div class="partner-actions"><button class="btn gold" type="submit">Send sign-in link</button></div>
          </form>
          <div id="partnerInboxNotice" class="partner-status" style="display:none;margin-top:12px"></div>
        </section>
      </div>`;
    const typeOptions = TYPES.map(([v,l]) => `<option value="${v}">${l}</option>`).join("");
    const messages = state.messages.map(m => {
      const outgoing = m.sender_id === state.user.id;
      const type = TYPES.find(x => x[0] === m.message_type)?.[1] || "Message";
      return `<article class="partner-message ${outgoing ? "outgoing" : "incoming"}">
        <div class="partner-message-head"><span class="partner-message-type">${esc(type)}</span><span>${outgoing ? "You" : "Your partner"} · ${esc(fmt(m.created_at))}</span></div>
        <div class="partner-message-body">${esc(m.body)}</div>
      </article>`;
    }).join("");
    return `
      <div class="partner-page">
        <section class="partner-hero"><h2>${title}</h2><p>${subtitle}</p><div class="partner-actions"><span class="partner-small">Signed in as ${esc(state.user.email)}</span><button class="btn" onclick="window.partnerInboxRefresh()">↻ Refresh</button><button class="btn" onclick="window.partnerInboxSignOut()">Sign out</button></div></section>
        <div id="partnerInboxNotice" class="partner-status" ${state.error ? "" : "style=\"display:none\""}>${esc(state.error || state.note)}</div>
        <section class="partner-compose">
          <h3>Send something</h3>
          <form onsubmit="window.partnerInboxSend(event)">
            <label for="partnerInboxType">Message type</label><select id="partnerInboxType">${typeOptions}</select>
            <label for="partnerInboxBody">Your message</label><textarea id="partnerInboxBody" maxlength="5000" placeholder="Write something kind, honest, or important…" required></textarea>
            <div class="partner-actions"><button class="btn gold" type="submit" ${state.loading ? "disabled" : ""}>Send message</button></div>
          </form>
        </section>
        <section class="partner-compose"><div class="row between"><h3>Shared conversation</h3><span class="partner-small">${state.messages.length} messages</span></div>
          <div class="partner-thread">${messages || '<div class="partner-empty">No messages yet. You can start the conversation.</div>'}</div>
        </section>
        <p class="partner-small">Only messages in this shared inbox are connected. Your daily pages, habits, budgets, and other planner records stay separate.</p>
      </div>`;
  }

  async function loadMessages() {
    const client = getClient();
    if (!client || !state.user) return;
    state.loading = true;
    try {
      const { data, error } = await client.from("partner_messages")
        .select("id,pair_id,sender_id,body,message_type,created_at")
        .eq("pair_id", PAIR_ID)
        .order("created_at", { ascending:true });
      if (error) throw error;
      state.messages = data || [];
      const lastRead = localStorage.getItem(lastReadKey()) || "1970-01-01T00:00:00.000Z";
      state.unread = state.messages.filter(m => m.sender_id !== state.user.id && new Date(m.created_at) > new Date(lastRead)).length;
      localStorage.setItem(lastReadKey(), new Date().toISOString());
      state.error = "";
    } catch (e) {
      state.error = e?.message || "Could not load messages.";
    } finally {
      state.loading = false;
      updateTileBadge();
    }
  }

  async function refresh() {
    await loadMessages();
    if (typeof window.render === "function" && (window.page === "partnerInbox" || document.body.dataset.page === "partnerInbox")) {
      window.render();
    } else if (document.getElementById("view") && document.body.dataset.page === "partnerInbox") {
      document.getElementById("view").innerHTML = pageHtml();
    }
  }

  window.partnerInboxSignIn = async function (event) {
    event.preventDefault();
    const email = document.getElementById("partnerInboxEmail")?.value.trim().toLowerCase();
    const notice = document.getElementById("partnerInboxNotice");
    if (!ALLOWED_EMAILS.includes(email)) {
      if (notice) { notice.style.display="block"; notice.className="partner-status error"; notice.textContent="That email is not a member of this shared inbox."; }
      return;
    }
    const client = getClient();
    try {
      const { error } = await client.auth.signInWithOtp({
        email,
        options:{ emailRedirectTo: location.href.split("#")[0], shouldCreateUser:false }
      });
      if (error) throw error;
      if (notice) { notice.style.display="block"; notice.className="partner-status"; notice.textContent="Sign-in link sent. Open the email on this device to finish signing in."; }
    } catch (e) {
      if (notice) { notice.style.display="block"; notice.className="partner-status error"; notice.textContent=e.message || "Could not send sign-in link."; }
    }
  };

  window.partnerInboxSignOut = async function () {
    const client = getClient();
    if (client) await client.auth.signOut();
    state.user = null; state.messages = []; state.unread = 0;
    window.go("partnerInbox");
  };

  window.partnerInboxSend = async function (event) {
    event.preventDefault();
    const body = document.getElementById("partnerInboxBody")?.value.trim();
    const message_type = document.getElementById("partnerInboxType")?.value || "message";
    if (!body || !state.user) return;
    const client = getClient();
    try {
      const { error } = await client.from("partner_messages").insert({
        pair_id:PAIR_ID, sender_id:state.user.id, body, message_type
      });
      if (error) throw error;
      document.getElementById("partnerInboxBody").value = "";
      state.note = "Message sent.";
      state.error = "";
      await loadMessages();
      window.render();
    } catch (e) {
      state.error = e?.message || "Message could not be sent.";
      state.note = "";
      window.render();
    }
  };

  window.partnerInboxRefresh = async function () {
    await loadMessages();
    window.render();
  };

  window.partnerInboxPage = function () {
    styles();
    if (!initialized) {
      initialized = true;
      const client = getClient();
      if (client) {
        client.auth.getSession().then(({ data }) => {
          state.user = data?.session?.user || null;
          if (state.user) loadMessages().then(() => {
            if (document.body.dataset.page === "partnerInbox") window.render();
          });
          else if (document.body.dataset.page === "partnerInbox") window.render();
        });
        client.auth.onAuthStateChange((_event, session) => {
          state.user = session?.user || null;
          if (state.user) loadMessages().then(() => {
            if (document.body.dataset.page === "partnerInbox") window.render();
          });
          else {
            state.messages = [];
            if (document.body.dataset.page === "partnerInbox") window.render();
          }
        });
      }
    }
    return pageHtml();
  };

  function install() {
    styles();
    if (Array.isArray(pages) && !pages.some(p => p[0] === "partnerInbox")) {
      pages.push(["partnerInbox", "✉", "Partner Inbox"]);
    }
    addTileToHome();
    if (document.getElementById("view") && document.body.dataset.page === "home") {
      try { window.render(); } catch (_) {}
    }
  }

  if (!document.querySelector('script[data-partner-supabase]')) {
    const sdk = document.createElement("script");
    sdk.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    sdk.dataset.partnerSupabase = "true";
    sdk.onload = install;
    sdk.onerror = () => { install(); };
    document.head.appendChild(sdk);
  } else {
    install();
  }
  window.addEventListener("load", install);
})();