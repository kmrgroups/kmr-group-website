/* KMR Apps portal — one link per customer (www.kmr-groups.com/it/app/<customer>).
   Signed-in people see the apps their company bought (Console licences) and can open them; the others can be
   tried with sample data only, with a Buy subscription link. The same KMR login works in every app. */
(function () {
  "use strict";
  const C = window.COMPANY_CONFIG || {};
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const m = location.pathname.match(/\/it\/app\/([a-z0-9-]{2,61})/i) || location.search.match(/[?&]c=([a-z0-9-]{2,61})/i);
  const SLUG = m && !/^(undefined|null)$/i.test(m[1]) ? m[1].toLowerCase() : "";
  const META = {
    hrm: { color: "#0EA5E9", desc: "Employees, onboarding, ID cards, biometric attendance, shifts and leave.", demo: "/it/hrm/api/auth/demo" },
    balloon: { color: "#A855F7", desc: "Balloon any drawing and build the inspection report.", demo: "/it/balloon.html?demo=1" },
    pd: { color: "#F59E0B", desc: "PFD, PFMEA, Control Plan, SOP, SPC, MSA and reports from the ballooned drawing.", demo: "/it/pd.html?demo=1&sample=1" },
  };
  const SOON = [["ppc", "Production Planning & Control"], ["qms", "QMS"], ["maint", "Maintenance"], ["proc", "Procurement"], ["crm", "CRM & RFQ"], ["mmd", "MMD"], ["wms", "Warehouse Management"], ["8d", "8D Problem Solving"], ["apqp", "APQP & PPAP"], ["fmea", "AIAG-VDA FMEA"], ["spc", "SPC & MSA"], ["audit", "IATF / ISO / VDA 6.3 audits"]];
  let brand = { name: "KMR Apps", logo_url: null }, rows = [], user = null;

  const logo = (b, cls) => b.logo_url ? `<img src="${esc(b.logo_url)}" alt="${esc(b.name)}">` : `<span class="fb ${cls || ""}">${esc((b.name || "K").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase())}</span>`;
  const buyUrl = (code) => `/it/?buy=${encodeURIComponent(code)}${SLUG ? "&c=" + SLUG : ""}#pilot`;

  function dialog(title, body, actions) {
    const v = document.createElement("div"); v.className = "veil";
    v.innerHTML = `<div class="dlg" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${body}</p><div class="row">${actions}<button class="btn ghost" data-close>Close</button></div></div>`;
    v.addEventListener("click", (e) => { if (e.target === v || e.target.hasAttribute("data-close")) v.remove(); });
    document.body.append(v);
  }

  function loginView(note) {
    $("#root").innerHTML = `<div class="split">
      <section class="vis" id="vis" aria-hidden="true"><div class="aur"><i></i><i></i><i></i><i></i></div><canvas></canvas>
        <div class="chip"><b>K</b>KMR Apps</div>
        <div class="cap"><h2>Agentic AI · <em>Intelligent Digital Manufacturing Systems</em></h2><p>HR, quality, planning and plant operations — one sign-in, one platform.</p></div></section>
      <section class="panel"><div class="form">
        <div class="co">${logo(brand)}<div>${esc(brand.name)}<small>${SLUG ? "Your KMR apps" : "KMR Group of Companies"}</small></div></div>
        <h1>Welcome</h1><p class="sub">${SLUG ? "Sign in to open your company's apps." : "Please use the link sent to you by KMR to open your company's apps."}</p>
        <form id="lf">
          <label class="f">Email<div class="in"><input name="email" type="email" autocomplete="username" required></div></label>
          <label class="f">Password<div class="in"><input name="password" type="password" autocomplete="current-password" required><button type="button" class="eye" aria-label="Show password">👁</button></div></label>
          <div class="msg" id="lm">${esc(note || "")}</div>
          <button class="btn block" type="submit">Sign in</button>
        </form>
        <div class="links"><button id="forgot" type="button">Forgot password? Email me a sign-in link</button></div>
      </div></section></div>`;
    window.KMR_SCENE && window.KMR_SCENE($("#vis"));
    const f = $("#lf"), msg = $("#lm");
    f.querySelector(".eye").onclick = () => { const i = f.password; i.type = i.type === "password" ? "text" : "password"; };
    f.onsubmit = async (e) => {
      e.preventDefault(); msg.className = "msg"; msg.textContent = "Signing in…";
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      if (error) { msg.textContent = /Invalid login/i.test(error.message) ? "Wrong email or password." : error.message; return; }
      start();
    };
    $("#forgot").onclick = async () => {
      const email = f.email.value.trim(); if (!email) { msg.textContent = "Enter your email first."; return; }
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.href } });
      msg.className = error ? "msg" : "msg ok"; msg.textContent = error ? "Could not send the link. Please try again in a minute." : `If ${email} has a KMR login, a sign-in link is on its way.`;
    };
  }

  async function open(code) {
    const r = rows.find((x) => x.product_code === code);
    if (!r || !r.purchased) {
      const meta = META[code];
      return dialog(`${r ? r.product_name : code} isn't in your plan`,
        `You can try it with <b>sample data only</b> — nothing you enter there is kept. To use it with your company's real data, take a subscription.`,
        `${meta ? `<a class="btn" href="${meta.demo}" target="_blank" rel="noopener">Try with sample data</a>` : ""}<a class="btn ghost" href="${buyUrl(code)}">Buy subscription</a>`);
    }
    if (!r.ok) return dialog(`${r.product_name}: access paused`, esc(r.message || "Your licence is not active.") + " Your data is safe and returns as soon as the subscription is renewed.", `<a class="btn" href="${buyUrl(code)}">Renew subscription</a>`);
    if (code === "hrm") {
      const { data: { session } } = await sb.auth.getSession(); if (!session) return loginView("Please sign in again.");
      const fm = document.createElement("form"); fm.method = "POST"; fm.action = "/it/hrm/api/auth/handoff";
      [["access_token", session.access_token], ["refresh_token", session.refresh_token]].forEach(([k, v]) => { const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; fm.append(i); });
      document.body.append(fm); fm.submit(); return;
    }
    location.href = r.app_path;
  }

  function appView() {
    const mine = rows.filter((r) => r.purchased), others = rows.filter((r) => !r.purchased);
    const pill = (r) => r.ok ? `<span class="pill ok">${esc(r.status)}${r.valid_until ? " · until " + esc(r.valid_until) : ""}</span>` : `<span class="pill warn">${esc(r.status)}</span>`;
    $("#root").innerHTML = `<div class="app">
      <aside class="side">
        <div class="who">${logo(brand)}<div><b>${esc(brand.name)}</b><small>${esc(user.email)}</small></div></div>
        <h4>Your apps</h4>${mine.map((r) => `<button data-open="${r.product_code}"><i style="background:${META[r.product_code]?.color || "#999"}"></i>${esc(r.product_name)}</button>`).join("") || `<small style="padding:0 10px;opacity:.6">No apps yet</small>`}
        <h4>More KMR apps</h4>${others.map((r) => `<button data-open="${r.product_code}"><i style="background:${META[r.product_code]?.color || "#999"}"></i>${esc(r.product_name)}<span class="lock">Try</span></button>`).join("")}
        ${SOON.map(([k, n]) => `<button data-soon="${k}" data-name="${esc(n)}"><i style="background:#64748b"></i>${esc(n)}<span class="lock">Soon</span></button>`).join("")}
        <button class="out" id="out">Sign out</button>
      </aside>
      <main class="main">
        <h1>Welcome back</h1><p class="sub">Open any app your company uses. The same login works everywhere.</p>
        <div class="cards">${mine.map((r) => `<div class="card" style="--c:${META[r.product_code]?.color}"><h3>${esc(r.product_name)}</h3><p>${esc(META[r.product_code]?.desc || "")}</p><div class="st">${pill(r)}</div><button class="btn" data-open="${r.product_code}">Open ${esc(r.product_name)}</button></div>`).join("")}</div>
        <h2 style="margin:34px 0 0;font-size:18px">Try more of the platform</h2>
        <div class="cards">${others.map((r) => `<div class="card locked" style="--c:${META[r.product_code]?.color}"><h3>${esc(r.product_name)}</h3><p>${esc(META[r.product_code]?.desc || "")}</p><div class="st"><span class="pill off">Not in your plan</span></div><button class="btn ghost" data-open="${r.product_code}">Try with sample data</button></div>`).join("")}</div>
      </main></div>`;
    document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => open(b.dataset.open)));
    document.querySelectorAll("[data-soon]").forEach((b) => b.addEventListener("click", () => dialog(`${b.dataset.name} — coming soon`, "This module of the KMR Intelligent Digital Manufacturing platform is on its way. Register your interest and we'll invite you to the pilot.", `<a class="btn" href="${buyUrl(b.dataset.soon)}">Register interest</a>`)));
    $("#out").onclick = async () => { await sb.auth.signOut(); loginView(); };
  }

  async function start() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session || !SLUG) return loginView();
    user = session.user;
    const { data, error } = await sb.rpc("kmr_portal", { p_slug: SLUG });
    if (error) return loginView("Could not load your apps right now. Please try again.");
    if (!data || !data.length) { await sb.auth.signOut(); return loginView(`This login does not belong to ${brand.name}. Use the email your company's apps were set up with.`); }
    rows = data; brand = { name: data[0].customer_name, logo_url: data[0].logo_url };
    appView();
  }

  (async () => {
    if (SLUG) { const { data } = await sb.rpc("kmr_portal_brand", { p_slug: SLUG }); if (data && data[0]) brand = data[0]; }
    document.title = `${brand.name} · KMR Apps`;
    start();
  })();
})();
