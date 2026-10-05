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
  const HASH = location.hash.replace(/^#/, "");                                      // the screen this address points at (#ops, #users …)
  /* Every menu item is a real link, so right-click › Open in new tab / new window works and opens that exact screen.
     A normal left click still switches screen in place (no reload); ctrl / ⌘ / shift / middle-click follow the link. */
  const BASE = location.pathname + (/\/it\/app\//.test(location.pathname) || !SLUG ? "" : "?c=" + SLUG);
  const appHref = (code) => BASE + (BASE.includes("?") ? "&" : "?") + "open=" + encodeURIComponent(code);
  const viewHref = (v) => BASE + (v ? "#" + v : "");
  const plain = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  const setView = (v) => { try { history.replaceState(null, "", viewHref(v)); } catch (e) { /* ignore */ } };
  const onLink = (sel, fn) => document.querySelectorAll(sel).forEach((el) => el.addEventListener("click", (e) => { if (!plain(e)) return; e.preventDefault(); fn(el, e); }));
  const META = {
    hrm: { color: "#0EA5E9", desc: "Employees, onboarding, ID cards, biometric attendance, shifts and leave.", demo: "/it/hrm/api/auth/demo" },
    balloon: { color: "#A855F7", desc: "Balloon any drawing and build the inspection report.", demo: "/it/balloon.html?demo=1" },
    pd: { color: "#F59E0B", desc: "PFD, PFMEA, Control Plan, SOP, SPC, MSA and reports from the ballooned drawing.", demo: "/it/pd.html?demo=1&sample=1" },
    capacity: { color: "#10B981", desc: "Capacity plan, takt time and machine loading for every plant, with version history.", demo: "/it/capacity.html?demo=1" },
    sales: { color: "#E11D48", desc: "Monthly sales plan vs actual despatch, daily tracking, loss reasons and action plans.", demo: "/it/sales.html?demo=1" },
    calib: { color: "#6366F1", desc: "Instrument register, calibration due control, gauge history, MSA and out-of-tolerance cases.", demo: "/it/calibration.html?demo=1" },
  };
  const SOON = [["ppc", "Production Planning & Control (full MES)"], ["qms", "QMS"], ["maint", "Maintenance"], ["proc", "Procurement"], ["crm", "CRM & RFQ"], ["mmd", "MMD"], ["wms", "Warehouse Management"], ["8d", "8D Problem Solving"], ["apqp", "APQP & PPAP"], ["fmea", "AIAG-VDA FMEA"], ["spc", "SPC & MSA"], ["audit", "IATF / ISO / VDA 6.3 audits"]];
  let brand = { name: "KMR Apps", logo_url: null }, rows = [], user = null, stats = {}, isAdmin = false, view = "home", ops = null, media = {};

  /** top of an app card: the app photo set in Website CMS (or the built-in illustration) — never a video: videos are for the public website only */
  const ART = { hrm: 1, balloon: 1, pd: 1, capacity: 1, sales: 1, calib: 1 };
  const safeUrl = (u) => (/^(https:\/\/|\/)/.test(u || "") ? String(u).replace(/["<>]/g, "") : "");
  function mediaHtml(r) {
    const m = media[r.product_code] || {}, img = safeUrl(m.img) || (ART[r.product_code] ? `/img/kmr/app-${r.product_code}.svg` : "");
    return img ? `<div class="media"><img src="${img}" alt="" loading="lazy"></div>` : "";
  }

  const logo = (b, cls) => b.logo_url ? `<img src="${esc(b.logo_url)}" alt="${esc(b.name)}">` : `<span class="fb ${cls || ""}">${esc((b.name || "K").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase())}</span>`;
  function setIcon(url) {
    if (!url) return;
    document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove());
    const ic = document.createElement("link"); ic.rel = "icon"; ic.href = url; document.head.append(ic);
  }
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
      if (!meta) return dialog(`${r ? r.product_name : code} — sample data`, "The sample-data version of this app is not available yet. Ask KMR for a demo.", `<a class="btn" href="${buyUrl(code)}">Contact KMR</a>`);
      location.href = meta.demo + (meta.demo.includes("?") ? "&" : "?") + "from=" + encodeURIComponent(SLUG);
      return;
    }
    if (!r.has_access) {
      if (!r.is_contact && !isAdmin) return dialog(`No access to ${r.product_name}`, "Your company has this app, but you have not been given access to it. Your company administrator can add it under Administration › Users & access.", "");
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
    let path = r.app_path;
    try { const back = sessionStorage.getItem("kmr-return-" + code); sessionStorage.removeItem("kmr-return-" + code);
      if (back && back.split(/[?#]/)[0] === r.app_path.split("?")[0]) path = back; } catch (e) {}
    let tail = ""; const hi = path.indexOf("#"); if (hi >= 0) { tail = path.slice(hi); path = path.slice(0, hi); }   // the screen (#go=…) stays at the end
    path = path.replace(/([?&])co=[^&]*&?/, "$1").replace(/[?&]$/, "");
    location.href = path + (path.includes("?") ? "&" : "?") + "kmr=1" + (SLUG ? "&co=" + encodeURIComponent(SLUG) : "") + tail;
  }

  function appView() {
    window.scrollTo(0, 0); setView("");
    const mine = rows.filter((r) => r.purchased), others = rows.filter((r) => !r.purchased);
    const pill = (r) => r.ok ? `<span class="pill ok">${esc(r.status)}${r.valid_until ? " · until " + esc(r.valid_until) : ""}</span>` : `<span class="pill warn">${esc(r.status)}</span>`;
    $("#root").innerHTML = `<div class="app">
      <aside class="side">
        <a class="who" href="${viewHref("")}" title="Your apps">${logo(brand)}<div><b>${esc(brand.name)}</b><small>${esc(user.email)}</small></div></a>
        <h4>Your apps</h4>${mine.map((r) => `<a href="${appHref(r.product_code)}" data-open="${r.product_code}"><i style="background:${META[r.product_code]?.color || "#999"}"></i>${esc(r.product_name)}${r.ok ? "" : '<span class="lock">Paused</span>'}</a>`).join("") || `<small style="padding:0 10px;opacity:.6">No apps yet</small>`}
        ${ops || isAdmin ? `<h4>Masters</h4>` : ""}${ops ? `<a href="${viewHref("ops")}" data-ops="1"><i style="background:#0EA5E9"></i>Operations Master</a>` : ""}${isAdmin ? `<a href="${viewHref("data")}" data-datam="1"><i style="background:#0EA5E9"></i>Data Master</a><a href="${viewHref("grand")}" data-grand="1"><i style="background:#B45309"></i>Grand Master</a>` : ""}
        ${isAdmin ? `<h4>Administration</h4><a href="${viewHref("company")}" data-admin="company"><i style="background:#F3C55A"></i>Company details &amp; logo</a><a href="${viewHref("users")}" data-admin="users"><i style="background:#F3C55A"></i>Users &amp; access</a><a href="${viewHref("invoices")}" data-admin="invoices"><i style="background:#F3C55A"></i>Invoices &amp; payments</a>` : ""}
        <h4>More KMR apps</h4>${others.map((r) => `<a href="${appHref(r.product_code)}" data-open="${r.product_code}"><i style="background:${META[r.product_code]?.color || "#999"}"></i>${esc(r.product_name)}<span class="lock">Try</span></a>`).join("")}
        ${SOON.map(([k, n]) => `<button data-soon="${k}" data-name="${esc(n)}"><i style="background:#64748b"></i>${esc(n)}<span class="lock">Soon</span></button>`).join("")}
        <button id="pw">Change password</button>
        <button class="out" id="out">Sign out</button>
      </aside>
      <main class="main">
        <h1>Welcome back</h1><p class="sub">Open any app your company uses. The same login works everywhere.</p>
        <div class="cards">${mine.map((r) => `<div class="card" style="--c:${META[r.product_code]?.color}">${mediaHtml(r)}<h3>${esc(r.product_name)}</h3><p>${esc(META[r.product_code]?.desc || "")}</p><div class="kpis">${Object.entries(stats[r.product_code] || {}).map(([k, v]) => `<div><b>${esc(v)}</b><small>${esc(k)}</small></div>`).join("")}</div><div class="st">${pill(r)}</div>${r.ok && !r.has_access && !r.is_contact && !isAdmin ? `<span class="pill off">No access — ask your administrator</span>` : `<a class="btn" href="${appHref(r.product_code)}" data-open="${r.product_code}">${r.ok ? "Open " + esc(r.product_name) : "Try with sample data"}</a>`}</div>`).join("")}</div>
        <h2 style="margin:34px 0 0;font-size:18px">Try more of the platform</h2>
        <div class="cards">${others.map((r) => `<div class="card locked" style="--c:${META[r.product_code]?.color}">${mediaHtml(r)}<h3>${esc(r.product_name)}</h3><p>${esc(META[r.product_code]?.desc || "")}</p><div class="st"><span class="pill off">Not in your plan</span></div><a class="btn ghost" href="${appHref(r.product_code)}" data-open="${r.product_code}">Try with sample data</a></div>`).join("")}</div>
      </main></div>`;
    onLink("[data-open]", (b) => open(b.dataset.open));
    onLink("[data-admin]", (b) => (b.dataset.admin === "company" ? companyView() : b.dataset.admin === "invoices" ? invoicesView() : usersView()));
    onLink("[data-datam]", () => dataView());
    onLink("[data-grand]", () => grandView());
    onLink("[data-ops]", () => opsView());
    onLink(".side .who", () => appView());
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


  /* ---------------- Administration (company administrators) ---------------- */
  const ROLE_OPTS = {
    hrm: [["", "No access"], ["company_admin", "Company admin"], ["hr_manager", "HR manager"], ["hr_executive", "HR executive"], ["manager", "Manager (own team)"], ["payroll", "Payroll"], ["interviewer", "Interviewer (interview panels)"]],
    other: [["", "No access"], ["admin", "Admin"], ["editor", "Editor"], ["viewer", "Viewer"]],
  };
  const mainEl = () => document.querySelector(".main");
  function adminHead(title, sub) { window.scrollTo(0, 0); document.querySelector(".main")?.scrollTo?.(0, 0); return `<p><a class="btn ghost" id="backApps" href="${viewHref("")}" style="height:36px">← Your apps</a></p><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>`; }
  function bindBack() { const b = $("#backApps"); if (b) b.onclick = (e) => { if (!plain(e)) return; e.preventDefault(); appView(); }; }

  const ctxOf = () => ({ sb, slug: SLUG, main: document.querySelector(".main"), dialog, base: BASE, setView });
  function dataView() { if (!window.KMR_DATA) return; setView("data"); return window.KMR_DATA.overview(ctxOf()); }
  function grandView() { if (!window.KMR_GRAND) return; setView("grand"); return window.KMR_GRAND.overview(ctxOf()); }
  async function opsView(kind) {
    if (!window.KMR_OPS || !ops) return;
    const c = { ...ctxOf(), role: ops.role, customerId: ops.customer_id };
    setView("ops"); await window.KMR_OPS.overview(c);
    if (kind) window.KMR_OPS.list(c, kind);
  }

  async function invoicesView() {
    setView("invoices");
    const head = adminHead("Invoices & payments", "Invoices from KMR for your subscriptions. Open one to view, print or pay it.");
    const m = mainEl(); m.innerHTML = head + `<p class="msg">Loading…</p>`; bindBack();
    const { data, error } = await sb.rpc("kmr_portal_invoices", { p_slug: SLUG });
    if (error) { m.querySelector(".msg").textContent = error.message; return; }
    const today = new Date().toISOString().slice(0, 10);
    const money = (v, c) => (c === "INR" ? "₹" : c === "USD" ? "$" : c === "EUR" ? "€" : c + " ") + Number(v).toLocaleString(c === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const date = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
    const tag = (r) => r.status === "paid" ? '<span class="pill ok">Paid</span>' : r.status === "cancelled" ? '<span class="pill off">Cancelled</span>'
      : r.reported ? '<span class="pill">Confirming payment</span>' : r.due_date && r.due_date < today ? '<span class="pill warn">Overdue</span>' : '<span class="pill">Due ' + esc(date(r.due_date)) + "</span>";
    const rows = data || [];
    m.innerHTML = head + `<div class="card" style="padding:0;overflow:auto;max-width:900px"><table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#F5F7FB;text-align:left"><th style="padding:10px 14px">Invoice</th><th style="padding:10px 14px">Date</th><th style="padding:10px 14px;text-align:right">Amount</th><th style="padding:10px 14px">Status</th><th></th></tr></thead>
      <tbody>${rows.map((r) => `<tr style="border-top:1px solid var(--line)"><td style="padding:10px 14px"><b>${esc(r.number)}</b></td><td style="padding:10px 14px">${esc(date(r.issue_date))}</td>
        <td style="padding:10px 14px;text-align:right;white-space:nowrap">${esc(money(r.total, r.currency))}</td><td style="padding:10px 14px">${tag(r)}</td>
        <td style="padding:10px 14px;text-align:right"><a class="btn ${r.status === "issued" ? "" : "ghost"}" style="height:34px" href="/it/console/pay/${encodeURIComponent(r.pay_token)}" target="_blank" rel="noopener">${r.status === "issued" && !r.reported ? "View &amp; pay" : "View"}</a></td></tr>`).join("")
        || '<tr><td colspan="5" style="padding:18px;color:var(--muted)">No invoices yet.</td></tr>'}</tbody></table></div>`;
    bindBack();
  }

  async function companyView() {
    setView("company");
    const m = mainEl(); m.innerHTML = adminHead("Company details & logo", "Shown in every KMR app your company uses — change it once here.") + `<p class="msg">Loading…</p>`; bindBack();
    const { data: c, error } = await sb.rpc("kmr_admin_company", { p_slug: SLUG });
    if (error) { m.querySelector(".msg").textContent = error.message; return; }
    const f = (k, label, full) => `<label class="f"${full ? ' style="grid-column:1/-1"' : ""}>${label}<div class="in"><input name="${k}" value="${esc(c[k] || "")}"></div></label>`;
    m.innerHTML = adminHead("Company details & logo", "Shown in every KMR app your company uses — change it once here.") + `
      <div class="card" style="max-width:760px">
        <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
          <div id="lgBox" style="width:96px;height:96px;border-radius:16px;border:1px solid var(--line);display:grid;place-items:center;background:#fff;overflow:hidden">${c.logo_url ? `<img src="${esc(c.logo_url)}" style="max-width:86px;max-height:86px;object-fit:contain">` : `<small style="color:var(--muted)">No logo</small>`}</div>
          <div><b>Company logo</b><br><small style="color:var(--muted)">PNG, JPG, WebP or SVG, under 2 MB. Square logos look best.</small><br><input type="file" id="lgFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="margin-top:8px"></div>
        </div>
        <form id="cf" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-top:18px">
          ${f("name", "Company name")}${f("legal_name", "Legal name (invoices, documents)")}${f("tax_id", "GSTIN / tax ID")}${f("contact_phone", "Phone")}
          ${f("address", "Address", true)}${f("city", "City")}${f("state", "State / region")}${f("postal_code", "Postal code")}
          <div style="grid-column:1/-1;display:flex;gap:12px;align-items:center"><button class="btn" type="submit">Save — update all apps</button><span class="msg" id="cm"></span></div>
        </form>
        <p style="font-size:13px;color:var(--muted);margin:10px 0 0">Applies to: ${(c.tools || []).map((t) => esc(t.name)).join(", ") || "your apps"}. Main contact: ${esc(c.contact_name || "")} (${esc(c.contact_email || "")}) — ask KMR to change it.</p>
      </div>`;
    bindBack();
    let logoUrl = null;
    $("#lgFile").onchange = async (e) => {
      const file = e.target.files[0]; const msg = $("#cm"); if (!file) return;
      if (file.size > 2 * 1024 * 1024) { msg.className = "msg"; msg.textContent = "The logo must be under 2 MB."; return; }
      msg.className = "msg"; msg.textContent = "Uploading logo…";
      const path = `customers/${c.id}/logo-${Date.now()}.${(file.name.split(".").pop() || "png").toLowerCase()}`;
      const up = await sb.storage.from("kmr-public").upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) { msg.textContent = "Upload failed: " + up.error.message; return; }
      logoUrl = sb.storage.from("kmr-public").getPublicUrl(path).data.publicUrl;
      $("#lgBox").innerHTML = `<img src="${esc(logoUrl)}" style="max-width:86px;max-height:86px;object-fit:contain">`;
      msg.textContent = "Logo ready — click Save to apply it everywhere.";
    };
    $("#cf").onsubmit = async (e) => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (logoUrl) d.logo_url = logoUrl;
      const msg = $("#cm"); msg.className = "msg"; msg.textContent = "Saving…";
      const r = await sb.rpc("kmr_admin_save_company", { p_slug: SLUG, p: d });
      if (r.error) { msg.textContent = r.error.message; return; }
      msg.className = "msg ok"; msg.textContent = "Saved. Every app now shows the new details.";
      brand = { name: d.name, logo_url: logoUrl || brand.logo_url }; try { localStorage.setItem("kmr-portal", JSON.stringify({ slug: SLUG, name: d.name, logo: brand.logo_url || null })); } catch (x) {}
      setIcon(brand.logo_url);
    };
  }

  async function usersView(note) {
    setView("users");
    const m = mainEl(); m.innerHTML = adminHead("Users & access", "One list for all your KMR apps. Choose what each person may do in each app.") + `<p class="msg">Loading…</p>`; bindBack();
    const [{ data: list, error }, { data: c }] = await Promise.all([sb.rpc("kmr_admin_users", { p_slug: SLUG }), sb.rpc("kmr_admin_company", { p_slug: SLUG })]);
    if (error) { m.querySelector(".msg").textContent = error.message; return; }
    const tools = [...((c && c.tools) || []), { code: "ops", name: "Operations Master" }];
    const label = (code, v) => ((code === "hrm" ? ROLE_OPTS.hrm : ROLE_OPTS.other).find((o) => o[0] === v) || ["", "—"])[1];
    m.innerHTML = adminHead("Users & access", "One list for all your KMR apps. Choose what each person may do in each app.") + `
      ${note ? `<div class="card" style="border-color:#1E7B4A;background:#E7F8EF;margin-bottom:14px">${note}</div>` : ""}
      <p><button class="btn" id="addU">+ Add a person</button></p>
      <div class="card" style="padding:0;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#F5F7FB;text-align:left"><th style="padding:10px 12px">Person</th>${tools.map((t) => `<th style="padding:10px 12px">${esc(t.name)}</th>`).join("")}<th style="padding:10px 12px">Last sign-in</th><th></th></tr></thead>
        <tbody>${(list || []).map((u) => `<tr style="border-top:1px solid var(--line)">
          <td style="padding:10px 12px"><b>${esc(u.name || u.email.split("@")[0])}</b>${u.is_admin ? ' <span class="pill ok">Admin</span>' : ""}<br><small style="color:var(--muted)">${esc(u.email)}</small></td>
          ${tools.map((t) => `<td style="padding:10px 12px">${u.roles && u.roles[t.code] ? `<span class="pill">${esc(label(t.code, u.roles[t.code]))}</span>` : '<small style="color:var(--muted)">No access</small>'}</td>`).join("")}
          <td style="padding:10px 12px"><small>${u.last_sign_in ? esc(new Date(u.last_sign_in).toLocaleDateString()) : u.has_login ? "Never" : "No login yet"}</small></td>
          <td style="padding:10px 12px;white-space:nowrap;text-align:right"><button class="btn ghost" data-edit="${esc(u.email)}" style="height:34px">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
    bindBack();
    const edit = (u) => {
      const isNew = !u; u = u || { email: "", name: "", is_admin: false, roles: {} };
      dialog(isNew ? "Add a person" : `Edit ${u.name || u.email}`, `
        <label class="f">Email<div class="in"><input id="uE" type="email" value="${esc(u.email)}" ${isNew ? "" : "readonly"}></div></label>
        <label class="f">Name<div class="in"><input id="uN" value="${esc(u.name || "")}"></div></label>
        ${tools.map((t) => `<label class="f">${esc(t.name)}<div class="in"><select id="uR_${t.code}">${(t.code === "hrm" ? ROLE_OPTS.hrm : ROLE_OPTS.other).map((o) => `<option value="${o[0]}" ${((u.roles || {})[t.code] || "") === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select></div></label>`).join("")}
        <label style="display:flex;gap:8px;align-items:center;margin:4px 0 12px"><input type="checkbox" id="uA" ${u.is_admin ? "checked" : ""}> Company administrator (Administration pages, users, company details)</label>
        ${isNew ? `<label class="f">Password for a new login<div class="in"><input id="uP" type="text" placeholder="At least 8 characters — only if this email has no KMR login yet"></div></label>` : (u.login_owned ? `<label class="f">New password (optional)<div class="in"><input id="uP" type="text" placeholder="Leave empty to keep the current password"></div></label>` : "")}
        <span class="msg" id="uM"></span>`,
        `<button class="btn" id="uSave">Save</button>${isNew ? "" : `<button class="btn ghost" id="uDel" style="color:#B00E28">Remove from all apps</button>`}`);
      $("#uSave").onclick = async () => {
        const msg = $("#uM"); msg.className = "msg"; msg.textContent = "Saving…";
        const roles = {}; tools.forEach((t) => (roles[t.code] = $("#uR_" + t.code).value));
        const pw = $("#uP") ? $("#uP").value.trim() : "";
        const r = await sb.rpc("kmr_admin_save_user", { p_slug: SLUG, p: { email: $("#uE").value.trim(), name: $("#uN").value.trim(), is_admin: $("#uA").checked, roles, password: isNew ? pw : "" } });
        if (r.error) { msg.textContent = r.error.message; return; }
        if (!isNew && pw) { const rp = await sb.rpc("kmr_admin_reset_password", { p_slug: SLUG, p_email: u.email, p_password: pw }); if (rp.error) { msg.textContent = rp.error.message; return; } }
        document.querySelector(".veil")?.remove();
        const em = esc($("#uE") ? $("#uE").value : u.email);
        usersView(r.data && r.data.new_login ? `<b>Saved.</b> Send this person the link <b>${esc(location.origin + "/it/app/" + SLUG)}</b>, their email and the password you set. They can change it under "Change password".` : `<b>Saved.</b> Access updated in every app.${isNew ? " This email already had a KMR login — they use their existing password." : ""}`);
      };
      if ($("#uDel")) $("#uDel").onclick = async () => {
        if (!confirm(`Remove ${u.email} from all your KMR apps?`)) return;
        const r = await sb.rpc("kmr_admin_remove_user", { p_slug: SLUG, p_email: u.email });
        if (r.error) { $("#uM").textContent = r.error.message; return; }
        document.querySelector(".veil")?.remove(); usersView("<b>Removed.</b> Their access to every app was switched off.");
      };
    };
    $("#addU").onclick = () => edit(null);
    document.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => edit((list || []).find((x) => x.email === b.dataset.edit))));
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
    try { localStorage.setItem("kmr-portal", JSON.stringify({ slug: SLUG, name: brand.name, logo: brand.logo_url || null })); } catch (e) {}
    setIcon(brand.logo_url);
    const st = await sb.rpc("kmr_portal_stats", { p_slug: SLUG }); stats = (st && st.data) || {};
    // the app photo set in KMR Console › Website CMS › KMR Apps on the website (videos are website-only)
    try { const cat = await sb.rpc("kmr_software_catalog"); (cat.data || []).forEach((a) => { media[a.code] = { img: a.image_url }; }); } catch (e) {}
    const ar = await sb.rpc("kmr_admin_role", { p_slug: SLUG }); isAdmin = !ar.error && ar.data === "admin";
    const oc = await sb.rpc("kmr_ops_context", { p_slug: SLUG }); ops = !oc.error && oc.data ? oc.data : null;
    appView();
    if (OPEN && rows.some((r) => r.product_code === OPEN)) { setView(""); open(OPEN); }
    else if ((HASH === "users" || HASH === "admin") && isAdmin) usersView();
    else if (HASH === "company" && isAdmin) companyView();
    else if (HASH === "invoices" && isAdmin) invoicesView();
    else if (HASH === "grand" && isAdmin) grandView();
    else if (HASH === "data" && isAdmin) dataView();
    else if (/^ops(\/|$)/.test(HASH) && ops) opsView(HASH.split("/")[1] || "");
  }

  (async () => {
    if (SLUG) { const { data } = await sb.rpc("kmr_portal_brand", { p_slug: SLUG }); if (data && data[0]) brand = data[0]; }
    if (brand.logo_url) setIcon(brand.logo_url);
    else { const k = await sb.rpc("kmr_platform_brand"); if (k.data && k.data.logo_url) { setIcon(k.data.logo_url); if (!SLUG) brand = { name: brand.name, logo_url: k.data.logo_url }; } }
    document.title = `${brand.name} · KMR Apps`;
    start();
  })();
})();
