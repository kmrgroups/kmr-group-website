/* KMR CCTV - Live view (grid + full screen), Cameras list, Connect this unit (relay set-up file), View log. Camera passwords are never stored: the set-up file is built in the browser. */
(function () {
  "use strict";
  const { $, esc, say, call } = QP;
  const S = { d: null, t: 0, hls: null };
  const adm = () => QP.ctx && (QP.ctx.role === "admin" || QP.ctx.is_staff), ed = () => QP.canEdit;
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const dt = (v) => (v ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—");
  const hashGo = () => { const m = location.hash.match(/go=([a-z]+)/); return m ? m[1] : "std"; };
  const base = () => (S.d && S.d.base_url ? S.d.base_url + "/" + S.d.path_secret : "");
  const url = (path, src) => base() + "/api/" + path + "?src=" + encodeURIComponent(src);
  const done = (r) => { S.d = r; return r; };
  async function load() { done(await call("kmr_cctv_load")); }

  function stopAll() { clearInterval(S.t); S.t = 0; if (S.hls) { S.hls.destroy(); S.hls = null; } }
  async function route() {
    stopAll(); const go = hashGo();
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === go));
    ["std", "live", "cams", "setup", "log"].forEach((s) => $("#" + s).classList.toggle("hide", s !== go));
    if (go === "std") return KMRStd.draw($("#std"), "cctv");
    try { await load(); ({ live: drawLive, cams: drawCams, setup: drawSetup, log: drawLog })[go](); } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);

  /* ---------- live view ---------- */
  function drawLive() {
    const cams = S.d.cams.filter((c) => c.active), el = $("#live");
    if (!base()) { el.innerHTML = `<div class="empty">This unit is not connected yet.<br>Open <b>Connect this unit</b> and follow the 3 steps (about 30 minutes, one time).</div>`; return; }
    if (!cams.length) { el.innerHTML = `<div class="empty">No cameras added yet. Open <b>Cameras</b> and add them.</div>`; return; }
    el.innerHTML = `<div class="guide">Tap a camera to watch it live in full screen. Pictures refresh every few seconds here to save mobile data.</div><div class="vgrid">${cams.map((c) => `<div class="vt" data-id="${c.id}" data-s="${esc(c.stream)}"><img alt="${esc(c.name)}"><i></i><b>${esc(c.name)}${c.area ? " · " + esc(c.area) : ""}</b><div class="off">Camera not reachable.<br>Check the unit PC and internet.</div></div>`).join("")}</div>`;
    const tick = () => el.querySelectorAll(".vt").forEach((t) => {
      const im = t.querySelector("img"), dot = t.querySelector("i"); im.onload = () => { t.classList.remove("bad"); dot.classList.add("on"); }; im.onerror = () => { t.classList.add("bad"); dot.classList.remove("on"); };
      im.src = url("frame.jpeg", t.dataset.s) + "&t=" + Date.now();
    });
    tick(); S.t = setInterval(tick, 4000);
    el.querySelectorAll(".vt").forEach((t) => (t.onclick = () => full(S.d.cams.find((c) => c.id === t.dataset.id))));
  }
  async function full(c) {
    try { await call("kmr_cctv_log", { p_cam: c.id, p_kind: "view" }); } catch (e) { /* log failure must not stop viewing */ }
    const b = document.createElement("div"); b.className = "big";
    b.innerHTML = `<div class="bar2"><button class="btn o" id="bx">← Back</button><b>${esc(c.name)}</b><span class="mut" id="bs" style="margin-left:auto">Connecting…</span></div><video id="bv" autoplay muted playsinline controls></video>`;
    document.body.appendChild(b); const v = b.querySelector("#bv"), st = b.querySelector("#bs"), src = url("stream.m3u8", c.stream); let h = null;
    const close = () => { if (h) h.destroy(); v.pause(); v.removeAttribute("src"); b.remove(); document.removeEventListener("keydown", esc2); };
    const esc2 = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc2); b.querySelector("#bx").onclick = close;
    v.addEventListener("playing", () => (st.textContent = "Live")); v.addEventListener("error", () => (st.textContent = "Cannot play. Check the unit connection."));
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = src; v.play().catch(() => {}); return; }
    try {
      const H = (await import("https://cdn.jsdelivr.net/npm/hls.js@1.5.17/+esm")).default;
      if (!H.isSupported()) { st.textContent = "This browser cannot play live video."; return; }
      h = new H({ liveSyncDurationCount: 2, maxLiveSyncPlaybackRate: 1.5 }); h.loadSource(src); h.attachMedia(v);
      h.on(H.Events.ERROR, (_, d) => { if (d.fatal) st.textContent = "Cannot play. Check the unit connection."; });
    } catch (e) { st.textContent = "Video player could not load."; }
  }

  /* ---------- cameras ---------- */
  function drawCams() {
    const el = $("#cams"), rows = S.d.cams;
    el.innerHTML = `<div class="guide">Add each camera once. The <b>camera code</b> is the short name used in the set-up file (for example gate1). The code must match the one in <b>Connect this unit</b>.</div>
    ${ed() ? `<div class="frm" style="margin-bottom:10px"><div><span class="lbl">Camera name</span><input id="cn" placeholder="Main gate"></div><div><span class="lbl">Area</span><input id="ca" placeholder="Entrance"></div><div><span class="lbl">Camera code</span><input id="cs" placeholder="gate1"></div><div style="align-self:end"><button class="btn" id="cadd">Add camera</button></div></div>` : ""}
    ${rows.length ? `<table><thead><tr><th>S.No</th><th>Camera</th><th>Area</th><th>Code</th><th>Show</th><th></th></tr></thead><tbody>${rows.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.name)}</td><td>${esc(c.area || "")}</td><td>${esc(c.stream)}</td><td>${c.active ? "Yes" : "Hidden"}</td><td>${ed() ? `<button class="btn o" data-h="${c.id}">${c.active ? "Hide" : "Show"}</button> <button class="btn d" data-x="${c.id}">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No cameras yet.</div>`}`;
    const act = async (fn) => { try { done(await fn()); say("Saved.", true); drawCams(); } catch (e) { say(e.message); } };
    if ($("#cadd")) $("#cadd").onclick = () => act(() => call("kmr_cctv_cam_save", { p_id: null, p_name: V("cn"), p_area: V("ca"), p_stream: V("cs"), p_active: true }));
    el.querySelectorAll("[data-h]").forEach((b) => (b.onclick = () => { const c = rows.find((x) => x.id === b.dataset.h); act(() => call("kmr_cctv_cam_save", { p_id: c.id, p_name: c.name, p_area: c.area, p_stream: c.stream, p_active: !c.active })); }));
    el.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => { if (confirm("Delete this camera from the list?")) act(() => call("kmr_cctv_cam_del", { p_id: b.dataset.x })); }));
  }

  /* ---------- connect this unit ---------- */
  const TPL = { hik: (u, p, ip, n) => `rtsp://${u}:${p}@${ip}:554/Streaming/Channels/${n}02`, dahua: (u, p, ip, n) => `rtsp://${u}:${p}@${ip}:554/cam/realmonitor?channel=${n}&subtype=1`, cpp: (u, p, ip, n) => `rtsp://${u}:${p}@${ip}:554/cam/realmonitor?channel=${n}&subtype=1` };
  function drawSetup() {
    const el = $("#setup"), has = !!S.d.base_url;
    el.innerHTML = `<div class="guide">One time per unit. Do these 3 steps on the always-on PC at the unit (the one on the same network as the recorder). Your camera passwords stay in the file on that PC. They are never saved in KMR.</div>
    <h3>Step 1 · Make the set-up file</h3>
    <div class="frm"><div><span class="lbl">Recorder / camera brand</span><select id="sb"><option value="hik">Hikvision (and Hik-OEM)</option><option value="dahua">Dahua</option><option value="cpp">CP Plus</option></select></div>
    <div><span class="lbl">Recorder IP address</span><input id="si" placeholder="192.168.1.64"></div><div><span class="lbl">Recorder user name</span><input id="su" placeholder="admin"></div><div><span class="lbl">Recorder password</span><input id="sp" type="password" autocomplete="off"></div><div><span class="lbl">Number of cameras</span><input id="sn" type="number" min="1" max="64" value="4"></div></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="sg">Make file</button><button class="btn o" id="sd" disabled>Download go2rtc.yaml</button></div>
    <pre class="out" id="so" style="display:none"></pre>
    <h3>Step 2 · Install and start the relay on the unit PC</h3>
    <p>Download <b>go2rtc</b> for Windows from <a href="https://github.com/AlexxIT/go2rtc/releases" target="_blank" rel="noopener">github.com/AlexxIT/go2rtc/releases</a> (file go2rtc_win64.zip). Unzip it, put the downloaded <b>go2rtc.yaml</b> next to go2rtc.exe, then double-click go2rtc.exe. Add it to Windows start-up so it runs after a power cut.</p>
    <h3>Step 3 · Open the secure tunnel and save its address here</h3>
    <p>Install the free <b>Cloudflare Tunnel</b> (cloudflared) on the same PC and point a tunnel address to <code>http://localhost:1984</code>. It needs no router change. Paste the https address it gives you below.</p>
    ${adm() ? `<div class="row"><input class="grow" id="bu" placeholder="https://cctv-unit1.yourdomain.com" value="${esc(S.d.base_url)}"><button class="btn" id="bsv">Save address</button>${has ? `<button class="btn o" id="brt">Change secret key</button>` : ""}</div>` : `<div class="lock mut">Only the administrator can save the tunnel address.</div>`}
    <p class="mut">Status: ${has ? `<span class="chip g">Address saved</span> <span id="bst">checking…</span>` : `<span class="chip x">Not connected</span>`}</p>`;
    let cfg = ""; const so = $("#so"), dl = $("#sd");
    $("#sg").onclick = () => {
      const n = Math.max(1, Math.min(64, +V("sn") || 1)), u = encodeURIComponent(V("su")), p = encodeURIComponent(V("sp")), ip = V("si").trim();
      if (!ip || !V("su")) { say("Enter the recorder IP address and user name."); return; }
      const lines = ["# KMR CCTV relay - made " + new Date().toLocaleString("en-IN"), "api:", "  listen: \"127.0.0.1:1984\"", "  base_path: \"/" + S.d.path_secret + "\"", "  origin: \"*\"", "streams:"];
      for (let i = 1; i <= n; i++) lines.push("  cam" + i + ": " + TPL[V("sb")](u, p, ip, i));
      cfg = lines.join("\n") + "\n"; so.style.display = "block"; so.textContent = cfg.replace(/:[^:@\/]*@/g, ":••••@"); dl.disabled = false;
      say("File ready. Camera codes are cam1 to cam" + n + ". Add them in Cameras with these codes.", true);
    };
    dl.onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([cfg], { type: "text/yaml" })); a.download = "go2rtc.yaml"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
    if ($("#bsv")) $("#bsv").onclick = async () => { try { done(await call("kmr_cctv_relay_set", { p_url: V("bu"), p_rotate: false })); say("Address saved.", true); drawSetup(); } catch (e) { say(e.message); } };
    if ($("#brt")) $("#brt").onclick = async () => { if (!confirm("A new secret key stops the old links. You must download the file again and restart go2rtc on the unit PC. Continue?")) return; try { done(await call("kmr_cctv_relay_set", { p_url: S.d.base_url, p_rotate: true })); say("New secret key made. Make the file again (Step 1).", true); drawSetup(); } catch (e) { say(e.message); } };
    if (has) fetch(base() + "/api/streams", { cache: "no-store" }).then((r) => (r.ok ? ($("#bst").textContent = "Relay is reachable ✔") : Promise.reject())).catch(() => { const b = $("#bst"); if (b) b.textContent = "Relay is not reachable yet. Check the unit PC, go2rtc and the tunnel."; });
  }

  /* ---------- view log ---------- */
  function drawLog() {
    const rows = S.d.log;
    $("#log").innerHTML = rows.length ? `<div class="guide">Who opened which camera, latest first (last 100).</div><table><thead><tr><th>S.No</th><th>When</th><th>Person</th><th>Camera</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${dt(r.at)}</td><td>${esc(r.email || "")}</td><td>${esc(r.cam_name || "")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Nobody has opened a camera yet.</div>`;
  }

  (async () => { try { await QP.init("cctv"); if (!QP.ctx) return; $("#role").textContent = QP.ctx.role; route(); } catch (e) { say(e.message); } })();
})();
