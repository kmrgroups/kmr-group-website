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
  const OPEN = (location.search.match(/[?&]open=([a-z0-9-]+)/i) || [])[1] || "";   // a tool sent the person here to sign in
  const META = {
    hrm: { color: "#0EA5E9", desc: "Employees, onboarding, ID cards, biometric attendance, shifts and leave.", demo: "/it/hrm/api/auth/demo" },
    balloon: { color: "#A855F7", desc: "Balloon any drawing and build the inspection report.", demo: "/it/balloon.html?demo=1" },
    pd: { color: "#F59E0B", desc: "PFD, PFMEA, Control Plan, SOP, SPC, MSA and reports from the ballooned drawing.", demo: "/it/pd.html?demo=1&sample=1" },
    capacity: { color: "#10B981", desc: "Capacity plan, takt time and machine loading for every plant, with version history.", demo: "/it/capacity.html?demo=1" },
  };
  const SOON = [["ppc", "Production Planning & Control (full MES)"], ["qms", "QMS"], ["maint", "Maintenance"], ["proc", "Procurement"], ["crm", "CRM & RFQ"], ["mmd", "MMD"], ["wms", "Warehouse Management"], ["8d", "8D Problem Solving"], ["apqp", "APQP & PPAP"], ["fmea", "AIAG-VDA FMEA"], ["spc", "SPC & MSA"], ["audit", "IATF / ISO / VDA 6.3 audits"]];
  let brand = { name: "KMR Apps", logo_url: null }, rows = [], user = null, stats = {};

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
        <h1>Welcome</h1><p class="sub">Sign in once — the same login opens every app your company uses.</p>
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
    if (!r || !r.purchased || !r.ok) {
      const meta = META[code];
      if (!meta) return;
      location.href = meta.demo + (meta.demo.includes("?") ? "&" : "?") + "from=" + encodeURIComponent(SLUG);
      return;
    }
    if (!r.has_access) {
      if (!r.is_contact) return dialog(`No access to ${r.product_name} yet`, "Your company has this app, but your login has not been added to it. Please ask your company's administrator to add you.", "");
      const j = await sb.rpc("kmr_portal_join", { p_slug: SLUG, p_product: code });
      if (j.error) return dialog(`Could not open ${r.product_name}`, esc(j.error.message), "");
      r.has_access = true;
    }
    if (code === "hrm") {
      const { data: { session } } = await sb.auth.getSession(); if (!session) return loginView("Please sign in again.");
      const fm = document.createElement("form"); fm.method = "POST"; fm.action = "/it/hrm/api/auth/handoff";
      [["access_token", session.access_token], ["refresh_token", session.refresh_token], ["co", r.product_slug || ""]].forEach(([k, v]) => { const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; fm.append(i); });
      document.body.append(fm); fm.submit(); return;
    }
    location.href = r.app_path + (r.app_path.includes("?") ? "&" : "?") + "kmr=1";
  }

  function appView() {
    const mine = rows.filter((r) => r.purchased), others = rows.filter((r) => !r.purchased);
    const pill = (r) => r.ok ? `<span class="pill ok">${esc(r.status)}${r.valid_until ? " · until " + esc(r.valid_until) : ""}</span>` : `<span class="pill warn">${esc(r.status)}</span>`;
    $("#root").innerHTML = `<div class="app">
      <aside class="side">
        <div class="who">${logo(brand)}<div><b>${esc(brand.name)}</b><small>${esc(user.email)}</small></div></div>
        <h4>Your apps</h4>${mine.map((r) => `<button data-open="${r.product_code}"><i style="background:${META[r.product_code]?.color || "#999"}"></i>${esc(r.product_name)}${r.ok ? "" : '<span class="lock">Paused</span>'}</button>`).join("") || `<small style="padding:0 10px;opacity:.6">No apps yet</small>`}
        <h4>More KMR apps</h4>${others.map((r) => `<button data-open="${r.product_code}"><i style="background:${META[r.product_code]?.color || "#999"}"></i>${esc(r.product_name)}<span class="lock">Try</span></button>`).join("")}
        ${SOON.map(([k, n]) => `<button data-soon="${k}" data-name="${esc(n)}"><i style="background:#64748b"></i>${esc(n)}<span class="lock">Soon</span></button>`).join("")}
        <button id="pw">Change password</button>
        <button class="out" id="out">Sign out</button>
      </aside>
      <main class="main">
        <h1>Welcome back</h1><p class="sub">Open any app your company uses. The same login works everywhere.</p>
        <div class="cards">${mine.map((r) => `<div class="card" style="--c:${META[r.product_code]?.color}"><h3>${esc(r.product_name)}</h3><p>${esc(META[r.product_code]?.desc || "")}</p><div class="kpis">${Object.entries(stats[r.product_code] || {}).map(([k, v]) => `<div><b>${esc(v)}</b><small>${esc(k)}</small></div>`).join("")}</div><div class="st">${pill(r)}</div><button class="btn" data-open="${r.product_code}">${r.ok ? "Open " + esc(r.product_name) : "Try with sample data"}</button></div>`).join("")}</div>
        <h2 style="margin:34px 0 0;font-size:18px">Try more of the platform</h2>
        <div class="cards">${others.map((r) => `<div class="card locked" style="--c:${META[r.product_code]?.color}"><h3>${esc(r.product_name)}</h3><p>${esc(META[r.product_code]?.desc || "")}</p><div class="st"><span class="pill off">Not in your plan</span></div><button class="btn ghost" data-open="${r.product_code}">Try with sample data</button></div>`).join("")}</div>
      </main></div>`;
    document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => open(b.dataset.open)));
    document.querySelectorAll("[data-soon]").forEach((b) => b.addEventListener("click", () => dialog(`${b.dataset.name} — coming soon`, "This module of the KMR Intelligent Digital Manufacturing platform is on its way. Register your interest and we'll invite you to the pilot.", `<a class="btn" href="${buyUrl(b.dataset.soon)}">Register interest</a>`)));
    $("#out").onclick = async () => { await sb.auth.signOut(); try { localStorage.removeItem("kmr-portal"); } catch (e) {} loginView(); };
    $("#pw").onclick = () => {
      dialog("Change password", `<label class="f">New password<div class="in"><input id="np1" type="password" minlength="8" autocomplete="new-password"></div></label><label class="f">Repeat new password<div class="in"><input id="np2" type="password" minlength="8" autocomplete="new-password"></div></label><span class="msg" id="npm"></span>`,
        `<button class="btn" id="npSave">Save password</button>`);
      $("#npSave").onclick = async () => {
        const a = $("#np1").value, b = $("#np2").value, m = $("#npm");
        if (a.length < 8) { m.textContent = "Use at least 8 characters."; return; }
        if (a !== b) { m.textContent = "The two passwords do not match."; return; }
        const { error } = await sb.auth.updateUser({ password: a });
        m.className = error ? "msg" : "msg ok"; m.textContent = error ? error.message : "Password changed. Use it for every KMR app.";
      };
    };
  }

  async function start() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return loginView();
    if (!SLUG) {   // signed in at the general address: go to this person's own company page
      const { data } = await sb.rpc("kmr_my_portals");
      if (data && data.length === 1) { location.replace(`/it/app/${data[0].slug}${OPEN ? "?open=" + OPEN : ""}`); return; }
      if (data && data.length > 1) { $("#root").innerHTML = `<div class="split" style="grid-template-columns:1fr"><section class="panel" style="border:0"><div class="form"><h1>Choose your company</h1><p class="sub">Your login belongs to more than one company.</p>${data.map((d) => `<p><a class="btn block" href="/it/app/${esc(d.slug)}${OPEN ? "?open=" + esc(OPEN) : ""}">${esc(d.name)}</a></p>`).join("")}</div></section></div>`; return; }
      await sb.auth.signOut(); return loginView("This login is not linked to any company's KMR Apps. Please use the link and login sent to you by KMR.");
    }
    user = session.user;
    const { data, error } = await sb.rpc("kmr_portal", { p_slug: SLUG });
    if (error) return loginView("Could not load your apps right now. Please try again.");
    if (!data || !data.length) { await sb.auth.signOut(); return loginView(`This login does not belong to ${brand.name}. Use the email your company's apps were set up with.`); }
    rows = data; brand = { name: data[0].customer_name, logo_url: data[0].logo_url };
    try { localStorage.setItem("kmr-portal", JSON.stringify({ slug: SLUG, name: brand.name })); } catch (e) {}
    const st = await sb.rpc("kmr_portal_stats", { p_slug: SLUG }); stats = (st && st.data) || {};
    appView();
    if (OPEN && rows.some((r) => r.product_code === OPEN)) { history.replaceState(null, "", location.pathname); open(OPEN); }
  }

  (async () => {
    if (SLUG) { const { data } = await sb.rpc("kmr_portal_brand", { p_slug: SLUG }); if (data && data[0]) brand = data[0]; }
    document.title = `${brand.name} · KMR Apps`;
    start();
  })();
})();
