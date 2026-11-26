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

  function stopAll() { clearInterval(S.t); S.t = 0; if (S.stop) { S.stop(); S.stop = null; } if (S.hls) { S.hls.destroy(); S.hls = null; } }
  async function route() {
    stopAll(); const go = hashGo();
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === go));
    ["std", "live", "cams", "setup", "log"].forEach((s) => $("#" + s).classList.toggle("hide", s !== go));
    if (go === "std") return KMRStd.draw($("#std"), "cctv");
    try { await load(); ({ live: drawLive, cams: drawCams, setup: drawSetup, log: drawLog })[go](); } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);

  /* ---------- live view ---------- */
  const PK = "kmr_cctv_prefs", P = { cols: "auto", fit: "contain", every: 8, mode: "pic" };
  try { Object.assign(P, JSON.parse(localStorage.getItem(PK) || "{}")); } catch (e) { /* storage may be blocked */ }
  const savePrefs = () => { try { localStorage.setItem(PK, JSON.stringify(P)); } catch (e) { /* ignore */ } };
  if (!document.getElementById("cctv-x")) {
    const st = document.createElement("style"); st.id = "cctv-x";
    st.textContent = `.vtool{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin-bottom:10px}.vtool .lbl{display:block;font-size:12px;color:#475569;margin-bottom:4px}.seg{display:flex;flex-wrap:wrap;gap:6px}.seg button{min-width:44px;min-height:40px;padding:6px 12px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-size:14px;cursor:pointer;touch-action:manipulation}.seg button.on{background:#0b3a8f;border-color:#0b3a8f;color:#fff;font-weight:600}
.vt img,.vt video{object-fit:var(--fit,contain)}.vt b{max-width:90%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wall{position:fixed;inset:0;z-index:60;background:#000;display:grid;gap:2px;padding:2px}.wall .vt{border-radius:0;aspect-ratio:auto;width:100%;height:100%}.wall .vt b{font-size:clamp(12px,1.4vw,22px)}.wall .wx{position:fixed;top:6px;right:8px;z-index:61;opacity:.35}.wall .wx:hover{opacity:1}
.big .stage{flex:1;min-height:0;position:relative;overflow:hidden;background:#000;touch-action:none}.big .stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:var(--fit,contain);transform-origin:0 0}.big .bar2{flex-wrap:wrap}`;
    document.head.appendChild(st);
  }
  const label = (c) => esc(c.name);
  const tileHtml = (c) => `<div class="vt" data-id="${c.id}" data-s="${esc(c.stream)}">${P.mode === "live" ? `<video muted autoplay playsinline></video>` : `<img alt="${label(c)}">`}<i></i><b>${label(c)}</b><div class="off">Camera not reachable.<br>Check the unit PC and internet.</div></div>`;
  /* Pictures are loaded two at a time and swapped only when ready, so the screen never blinks and the unit PC is not overloaded. */
  function frames(root) {
    let stop = false;
    const one = (t) => new Promise((res) => {
      const im = t.querySelector("img"), dot = t.querySelector("i"), n = new Image();
      n.onload = () => { im.src = n.src; t.classList.remove("bad"); dot.classList.add("on"); res(); };
      n.onerror = () => { t.classList.add("bad"); dot.classList.remove("on"); res(); };
      n.src = url("frame.jpeg", t.dataset.s) + "&t=" + Date.now();
    });
    (async () => {
      while (!stop) {
        const ts = [...root.querySelectorAll(".vt")], t0 = Date.now(); let k = 0;
        const lane = async () => { while (k < ts.length && !stop) await one(ts[k++]); };
        await Promise.all([lane(), lane()]);
        await new Promise((r) => setTimeout(r, Math.max(1000, P.every * 1000 - (Date.now() - t0))));
      }
    })();
    return () => { stop = true; };
  }
  let HLSM = null;
  const getHls = async () => (HLSM = HLSM || (await import("https://cdn.jsdelivr.net/npm/hls.js@1.5.17/+esm")).default);
  /* Live video in every tile: the light (sub) stream of each camera, so it plays smoothly on a normal internet line. */
  function liveTiles(root) {
    const hs = []; let dead = false;
    (async () => {
      let H; try { H = await getHls(); } catch (e) { return; }
      if (dead) return;
      root.querySelectorAll(".vt").forEach((t) => {
        const v = t.querySelector("video"), dot = t.querySelector("i"); if (!v) return;
        v.addEventListener("playing", () => { t.classList.remove("bad"); dot.classList.add("on"); });
        const play = (sn) => {
          const src = url("stream.m3u8", sn);
          if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = src; v.play().catch(() => {}); v.onerror = () => { if (sn !== t.dataset.s) play(t.dataset.s); else { t.classList.add("bad"); dot.classList.remove("on"); } }; return; }
          if (!H.isSupported()) { t.classList.add("bad"); return; }
          const h = new H({ liveSyncDurationCount: 2, maxLiveSyncPlaybackRate: 1.5, lowLatencyMode: true }); hs.push(h); h.loadSource(src); h.attachMedia(v);
          h.on(H.Events.ERROR, (_, d) => { if (!d.fatal) return; h.destroy(); if (sn !== t.dataset.s) play(t.dataset.s); else { t.classList.add("bad"); dot.classList.remove("on"); } });
        };
        play(t.dataset.s + "s");
      });
    })();
    return () => { dead = true; hs.forEach((h) => { try { h.destroy(); } catch (e) { /* ignore */ } }); root.querySelectorAll("video").forEach((v) => { v.pause(); v.removeAttribute("src"); }); };
  }
  const startTiles = (root) => (P.mode === "live" ? liveTiles(root) : frames(root));
  function drawLive() {
    const cams = S.d.cams.filter((c) => c.active), el = $("#live");
    if (!base()) { el.innerHTML = `<div class="empty">This unit is not connected yet.<br>Open <b>Connect this unit</b> and follow the 3 steps (about 30 minutes, one time).</div>`; return; }
    if (!cams.length) { el.innerHTML = `<div class="empty">No cameras added yet. Open <b>Cameras</b> and add them.</div>`; return; }
    const seg = (id, items, cur) => `<div class="seg" id="${id}">${items.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${t}</button>`).join("")}</div>`;
    el.innerHTML = `<div class="vtool">
      <div><span class="lbl">Cameras in one row</span>${seg("lc", [["auto", "Auto"], ...[1, 2, 3, 4, 5, 6].map((n) => [n, n])], P.cols)}</div>
      <div><span class="lbl">Picture</span>${seg("lf", [["contain", "Fit whole picture"], ["cover", "Fill the box"]], P.fit)}</div>
      <div><span class="lbl">Tiles show</span>${seg("lm", [["pic", "Pictures (saves data)"], ["live", "Live video (smooth)"]], P.mode)}</div>
      <div><span class="lbl">Picture refresh</span>${seg("lr", [[4, "4 seconds"], [8, "8 seconds"], [15, "15 seconds"], [30, "30 seconds"]], P.every)}</div>
      <div><button class="btn" id="lw">Show all on one screen</button></div></div>
      <div class="guide">${P.mode === "live" ? "Live video plays in every tile with the light stream. " : ""}Tap a camera to watch it live and zoom. <b>Show all on one screen</b> fills the whole monitor with every camera (press Esc to come back).</div>
      <div class="vgrid" id="vg">${cams.map(tileHtml).join("")}</div>`;
    const g = $("#vg"), apply = () => { g.style.setProperty("--fit", P.fit); g.style.gridTemplateColumns = P.cols === "auto" ? "" : `repeat(${P.cols},1fr)`; };
    apply();
    const pick = (id, fn) => { const box = $("#" + id); box.onclick = (e) => { const bt = e.target.closest("button"); if (!bt) return; box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === bt)); fn(bt.dataset.v); savePrefs(); }; };
    pick("lc", (v) => { P.cols = v; apply(); }); pick("lf", (v) => { P.fit = v; apply(); }); pick("lr", (v) => { P.every = +v; }); pick("lm", (v) => { P.mode = v; savePrefs(); stopAll(); drawLive(); });
    S.stop = startTiles(el);
    g.querySelectorAll(".vt").forEach((t) => (t.onclick = () => full(S.d.cams.find((c) => c.id === t.dataset.id))));
    $("#lw").onclick = () => wall(cams);
  }
  function wall(cams) {
    const w = document.createElement("div"); w.className = "wall"; w.style.setProperty("--fit", P.fit);
    const n = cams.length, W = innerWidth, H = innerHeight; let best = 1, bestA = 0;
    for (let c = 1; c <= n; c++) { const r = Math.ceil(n / c), tw = W / c, th = H / r, a = Math.min(tw, th * 16 / 9) * Math.min(tw * 9 / 16, th) * n; if (a > bestA) { bestA = a; best = c; } }
    w.style.gridTemplateColumns = `repeat(${best},1fr)`; w.style.gridTemplateRows = `repeat(${Math.ceil(n / best)},1fr)`;
    w.innerHTML = cams.map(tileHtml).join("") + `<button class="btn o wx" id="wx">✕ Close</button>`;
    document.body.appendChild(w);
    const stopF = startTiles(w);
    const close = () => { stopF(); document.removeEventListener("keydown", k); document.removeEventListener("fullscreenchange", fc); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); w.remove(); };
    const k = (e) => { if (e.key === "Escape") close(); }, fc = () => { if (!document.fullscreenElement) close(); };
    document.addEventListener("keydown", k); w.querySelector("#wx").onclick = close;
    w.querySelectorAll(".vt").forEach((t) => (t.onclick = () => { close(); full(S.d.cams.find((c) => c.id === t.dataset.id)); }));
    if (w.requestFullscreen) w.requestFullscreen().then(() => document.addEventListener("fullscreenchange", fc)).catch(() => {});
  }
  async function full(c) {
    try { await call("kmr_cctv_log", { p_cam: c.id, p_kind: "view" }); } catch (e) { /* log failure must not stop viewing */ }
    const b = document.createElement("div"); b.className = "big"; b.style.setProperty("--fit", P.fit);
    b.innerHTML = `<div class="bar2"><button class="btn o" id="bx">← Back</button><b>${esc(c.name)}</b><span class="mut" id="bs">Connecting…</span>
      <span style="margin-left:auto;display:flex;gap:6px;align-items:center"><button class="btn o" id="zm">−</button><span id="zp" style="min-width:44px;text-align:center">100%</span><button class="btn o" id="zpl">+</button><button class="btn o" id="zr">Reset</button><button class="btn o" id="zf">${P.fit === "cover" ? "Show whole picture" : "Fill screen"}</button><button class="btn o" id="zfs">Full screen</button></span></div>
      <div class="stage" id="stg"><video id="bv" autoplay muted playsinline></video></div>`;
    document.body.appendChild(b); const v = b.querySelector("#bv"), st = b.querySelector("#bs"), stg = b.querySelector("#stg"), zp = b.querySelector("#zp"), src = url("stream.m3u8", c.stream); let h = null;
    let z = 1, x = 0, y = 0;
    const paint = () => { const W = stg.clientWidth, H = stg.clientHeight; x = Math.min(0, Math.max(W - W * z, x)); y = Math.min(0, Math.max(H - H * z, y)); v.style.transform = `translate(${x}px,${y}px) scale(${z})`; zp.textContent = Math.round(z * 100) + "%"; };
    const zoomAt = (nz, cx, cy) => { nz = Math.min(8, Math.max(1, nz)); x = cx - ((cx - x) / z) * nz; y = cy - ((cy - y) / z) * nz; z = nz; paint(); };
    const mid = () => [stg.clientWidth / 2, stg.clientHeight / 2];
    b.querySelector("#zpl").onclick = () => zoomAt(z * 1.5, ...mid()); b.querySelector("#zm").onclick = () => zoomAt(z / 1.5, ...mid()); b.querySelector("#zr").onclick = () => { z = 1; x = 0; y = 0; paint(); };
    b.querySelector("#zf").onclick = (e) => { P.fit = P.fit === "cover" ? "contain" : "cover"; savePrefs(); b.style.setProperty("--fit", P.fit); e.target.textContent = P.fit === "cover" ? "Show whole picture" : "Fill screen"; };
    b.querySelector("#zfs").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else if (b.requestFullscreen) b.requestFullscreen().catch(() => {}); };
    stg.addEventListener("wheel", (e) => { e.preventDefault(); const r = stg.getBoundingClientRect(); zoomAt(z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    stg.addEventListener("dblclick", (e) => { const r = stg.getBoundingClientRect(); if (z > 1) { z = 1; x = 0; y = 0; paint(); } else zoomAt(2.5, e.clientX - r.left, e.clientY - r.top); });
    const pts = new Map(); let pd = 0;
    stg.addEventListener("pointerdown", (e) => { stg.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pd = 0; });
    stg.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return; const o = pts.get(e.pointerId);
      if (pts.size === 2) { const [a, c2] = [...pts.values()]; const d0 = Math.hypot(a[0] - c2[0], a[1] - c2[1]); pts.set(e.pointerId, [e.clientX, e.clientY]); const [a1, c1] = [...pts.values()]; const d1 = Math.hypot(a1[0] - c1[0], a1[1] - c1[1]); if (d0 > 0) { const r = stg.getBoundingClientRect(); zoomAt(z * d1 / d0, (a1[0] + c1[0]) / 2 - r.left, (a1[1] + c1[1]) / 2 - r.top); } return; }
      if (z > 1) { x += e.clientX - o[0]; y += e.clientY - o[1]; paint(); } pts.set(e.pointerId, [e.clientX, e.clientY]);
    });
    const up = (e) => pts.delete(e.pointerId); stg.addEventListener("pointerup", up); stg.addEventListener("pointercancel", up);
    const close = () => { if (h) h.destroy(); v.pause(); v.removeAttribute("src"); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); b.remove(); document.removeEventListener("keydown", esc2); };
    const esc2 = (e) => { if (e.key === "Escape" && !document.fullscreenElement) close(); };
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
    el.innerHTML = `<div class="guide">Type the <b>location name</b> of each camera (for example Gate, Press shop, Store). The Live screen shows this name instead of the camera number. The <b>camera code</b> (cam1, cam2…) is used by the unit PC and must not be changed.</div>
    ${ed() ? `<div class="frm" style="margin-bottom:10px"><div><span class="lbl">Location name</span><input id="cn" placeholder="Main gate"></div><div><span class="lbl">Area</span><input id="ca" placeholder="Entrance"></div><div><span class="lbl">Camera code</span><input id="cs" placeholder="gate1"></div><div style="align-self:end"><button class="btn" id="cadd">Add camera</button></div></div>` : ""}
    ${rows.length ? `${ed() ? `<div style="margin-bottom:8px"><button class="btn" id="csv">Save all names</button></div>` : ""}<table><thead><tr><th>S.No</th><th>Location name</th><th>Area</th><th>Code</th><th>Show</th><th></th></tr></thead><tbody>${rows.map((c, i) => `<tr><td>${i + 1}</td><td>${ed() ? `<input data-n="${c.id}" value="${esc(c.name)}" style="width:100%">` : esc(c.name)}</td><td>${ed() ? `<input data-a="${c.id}" value="${esc(c.area || "")}" style="width:100%">` : esc(c.area || "")}</td><td>${esc(c.stream)}</td><td>${c.active ? "Yes" : "Hidden"}</td><td>${ed() ? `<button class="btn o" data-h="${c.id}">${c.active ? "Hide" : "Show"}</button> <button class="btn d" data-x="${c.id}">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No cameras yet.</div>`}`;
    const act = async (fn) => { try { done(await fn()); say("Saved.", true); drawCams(); } catch (e) { say(e.message); } };
    if ($("#cadd")) $("#cadd").onclick = () => act(() => call("kmr_cctv_cam_save", { p_id: null, p_name: V("cn"), p_area: V("ca"), p_stream: V("cs"), p_active: true }));
    if ($("#csv")) $("#csv").onclick = async () => {
      try {
        for (const c of rows) {
          const n = el.querySelector(`[data-n="${c.id}"]`), a = el.querySelector(`[data-a="${c.id}"]`), nn = (n.value || "").trim(), aa = (a.value || "").trim();
          if (!nn) { say("A location name cannot be empty."); return; }
          if (nn !== c.name || aa !== (c.area || "")) done(await call("kmr_cctv_cam_save", { p_id: c.id, p_name: nn, p_area: aa, p_stream: c.stream, p_active: c.active }));
        }
        say("Saved.", true); drawCams();
      } catch (e) { say(e.message); }
    };
    el.querySelectorAll("[data-h]").forEach((b) => (b.onclick = () => { const c = rows.find((x) => x.id === b.dataset.h); act(() => call("kmr_cctv_cam_save", { p_id: c.id, p_name: c.name, p_area: c.area, p_stream: c.stream, p_active: !c.active })); }));
    el.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => { if (confirm("Delete this camera from the list?") && confirm("Are you sure? This removes the camera and its view history link.")) act(() => call("kmr_cctv_cam_del", { p_id: b.dataset.x })); }));
  }

  /* ---------- connect this unit ---------- */
  const TPL = { hik: (u, p, ip, n, q) => `rtsp://${u}:${p}@${ip}:554/Streaming/Channels/${n}0${q}`, dahua: (u, p, ip, n, q) => `rtsp://${u}:${p}@${ip}:554/cam/realmonitor?channel=${n}&subtype=${q === "1" ? 0 : 1}`, cpp: (u, p, ip, n, q) => `rtsp://${u}:${p}@${ip}:554/cam/realmonitor?channel=${n}&subtype=${q === "1" ? 0 : 1}` };
  function drawSetup() {
    const el = $("#setup"), has = !!S.d.base_url;
    el.innerHTML = `<div class="guide">One time per unit. Do these 3 steps on the always-on PC at the unit (the one on the same network as the recorder). Your camera passwords stay in the file on that PC. They are never saved in KMR.</div>
    <h3>Step 1 · Make the set-up file</h3>
    <div class="frm"><div><span class="lbl">Recorder / camera brand</span><select id="sb"><option value="hik">Hikvision (and Hik-OEM)</option><option value="dahua">Dahua</option><option value="cpp">CP Plus</option></select></div>
    <div><span class="lbl">Recorder IP address</span><input id="si" placeholder="192.168.1.64"></div><div><span class="lbl">Recorder user name</span><input id="su" placeholder="admin"></div><div><span class="lbl">Recorder password</span><input id="sp" type="password" autocomplete="off"></div><div><span class="lbl">Number of cameras</span><input id="sn" type="number" min="1" max="64" value="4"></div><div><span class="lbl">Picture quality</span><select id="sq"><option value="1">Clear (main stream)</option><option value="2">Light (sub stream, for slow internet)</option></select></div></div>
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
      for (let i = 1; i <= n; i++) { lines.push("  cam" + i + ": " + TPL[V("sb")](u, p, ip, i, V("sq") || "1")); lines.push("  cam" + i + "s: " + TPL[V("sb")](u, p, ip, i, "2")); }
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
