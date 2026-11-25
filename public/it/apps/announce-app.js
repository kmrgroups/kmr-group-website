/* KMR Shopfloor Announcer - plays scheduled announcements (hourly report, breaks, shift close, emergency) in 7 languages with a male / female voice,
   or your own recorded voice. Screens: Standards alignment, On air, Schedule, Messages, My voice, Voice check, Logs.
   The voices come from the computer that plays (Microsoft Edge on Windows has free natural voices for all 7 languages). Nothing is sent to any outside service. */
(function () {
  "use strict";
  const { $, esc, say, call } = QP;
  const LANGS = [["hi", "Hindi", "हिन्दी"], ["kn", "Kannada", "ಕನ್ನಡ"], ["en", "English", "English"], ["as", "Assamese", "অসমীয়া"], ["bn", "Bengali", "বাংলা"], ["or", "Odia", "ଓଡ଼ିଆ"], ["ne", "Nepali", "नेपाली"]];
  const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"]];
  const STYLE = { normal: { rate: 1, pitch: 1, label: "Normal" }, command: { rate: 0.9, pitch: 0.7, label: "Commanding (slower, deeper)" }, emergency: { rate: 0.92, pitch: 0.6, label: "Emergency (deepest, loudest)" } };
  const S = { d: null, armed: false, tok: 0, gen: 0, q: Promise.resolve(), now: "", fired: {}, ac: null, aud: null, cache: {}, lock: null, rec: null, recBlob: null, edit: null, tests: {} };
  const ed = () => QP.canEdit, pad = (n) => String(n).padStart(2, "0");
  const dt = (v) => (v ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "—");
  const hashGo = () => { const m = location.hash.match(/go=([a-z]+)/); return m ? m[1] : "std"; };
  const ymd = (n) => n.getFullYear() + "-" + pad(n.getMonth() + 1) + "-" + pad(n.getDate());
  const V = (id) => { const e = $("#" + id); return e ? (e.type === "checkbox" ? e.checked : e.value) : ""; };
  const lname = (c) => (LANGS.find((l) => l[0] === c) || [c, c])[1];

  /* ---------- messages (standard texts + this unit's changes) ---------- */
  function msgs() {
    const saved = (S.d && S.d.msgs) || [], out = window.ANN_DEFAULTS.map((m) => { const s = saved.find((x) => x.code === m.code); return { code: m.code, label: s ? s.label : m.label, texts: Object.assign({}, m.texts, s ? s.texts : {}), std: true }; });
    saved.forEach((s) => { if (!out.some((o) => o.code === s.code)) out.push({ code: s.code, label: s.label, texts: s.texts || {}, std: false }); });
    return out;
  }
  const msgOf = (code) => msgs().find((m) => m.code === code);
  const fill = (t, r) => String(t || "").replace(/\{mins\}/g, r && r.mins != null ? r.mins : "");

  /* ---------- voices (from the playing computer) ---------- */
  let VOICES = [];
  const loadVoices = () => { try { VOICES = window.speechSynthesis ? speechSynthesis.getVoices() || [] : []; } catch (e) { VOICES = []; } };
  loadVoices(); if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { loadVoices(); if (hashGo() === "vc") drawVc(); };
  const isF = (n) => /female|swara|neerja|tanishaa|sapna|yashica|subhasini|hemkala|heera|kalpana|aarti|kavya|ananya/i.test(n);
  const isM = (n) => !isF(n) && /\bmale\b|madhur|prabhat|bashkar|gagan|priyom|sukant|sagar|ravi\b|hemant|pradeep|kunal/i.test(n);
  const genOf = (v) => (isF(v.name) ? "female" : isM(v.name) ? "male" : "?");
  function pick(lang, g) {
    let c = VOICES.filter((v) => { const l = String(v.lang || "").toLowerCase().replace("_", "-"); return l === lang || l.startsWith(lang + "-"); });
    if (!c.length) return null;
    const sc = (v) => (genOf(v) === g ? 4 : 0) + (/natural|online/i.test(v.name) ? 2 : 0) + (/-in$|ne-np$/i.test(String(v.lang).replace("_", "-")) ? 3 : 0);
    c.sort((a, b) => sc(b) - sc(a)); return { v: c[0], exact: genOf(c[0]) === g };
  }

  /* ---------- sound ---------- */
  const ac = () => { if (!S.ac) S.ac = new (window.AudioContext || window.webkitAudioContext)(); if (S.ac.state === "suspended") S.ac.resume(); return S.ac; };
  const wait = (ms, my) => new Promise((res) => { const t0 = Date.now(), iv = setInterval(() => { if (S.tok !== my || Date.now() - t0 >= ms) { clearInterval(iv); res(); } }, 100); });
  function tone(f, t0, len, vol, type) { const a = ac(), o = a.createOscillator(), g = a.createGain(); o.type = type || "sine"; o.frequency.value = f; o.connect(g); g.connect(a.destination); const t = a.currentTime + t0; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.01, vol), t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.start(t); o.stop(t + len + 0.05); }
  async function bell(vol, my) { [[880, 0], [660, 0.5], [880, 1.0], [660, 1.5]].forEach(([f, t]) => tone(f, t, 0.55, 0.6 * vol, "sine")); await wait(2300, my); }
  async function siren(sec, vol, my) { const a = ac(), o = a.createOscillator(), g = a.createGain(); o.type = "sawtooth"; o.connect(g); g.connect(a.destination); const t = a.currentTime; g.gain.value = 0.45 * vol; for (let i = 0; i < sec / 0.6; i++) o.frequency.setValueAtTime(i % 2 ? 950 : 650, t + i * 0.6); o.start(t); o.stop(t + sec); await wait(sec * 1000 + 200, my); }
  function speakOne(text, v, st, vol, my) {
    return new Promise((res) => {
      const parts = String(text).split(/(?<=[.।!?])\s+/).filter(Boolean); let i = 0;
      const next = () => {
        if (S.tok !== my || i >= parts.length) return res();
        const u = new SpeechSynthesisUtterance(parts[i++]); u.voice = v; u.lang = v.lang; u.rate = STYLE[st].rate; u.pitch = STYLE[st].pitch; u.volume = Math.min(1, vol);
        let done = false; const fin = () => { if (!done) { done = true; clearTimeout(tm); next(); } }, tm = setTimeout(fin, 25000 + parts[i - 1].length * 120);
        u.onend = fin; u.onerror = fin; speechSynthesis.speak(u);
      };
      next();
    });
  }
  async function clip(id, vol, my) {
    if (!S.cache[id]) S.cache[id] = await call("kmr_ann_audio_get", { p_id: id });
    if (S.tok !== my) return;
    const r = S.cache[id], a = new Audio("data:" + r.mime + ";base64," + r.b64); a.volume = Math.min(1, vol); S.aud = a;
    await new Promise((res) => { a.onended = res; a.onerror = res; a.play().catch(res); const iv = setInterval(() => { if (S.tok !== my) { a.pause(); clearInterval(iv); res(); } else if (a.ended) clearInterval(iv); }, 200); });
  }
  function stopSound() { S.tok++; try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } if (S.aud) { S.aud.pause(); S.aud = null; } paint(); }

  /* ---------- playing one announcement ---------- */
  async function runItem(row, kind) {
    const my = ++S.tok; S.now = row.name; paint();
    const vol = (row.volume || 100) / 100, miss = [];
    try {
      if (row.chime === "siren") await siren(4, vol, my); else if (row.chime !== "none") await bell(vol, my);
      for (let r = 0; r < (row.repeat || 1) && S.tok === my; r++) {
        if (row.rec_id) await clip(row.rec_id, vol, my);
        else {
          const m = msgOf(row.msg_code); if (!m) { miss.push("message not found"); break; }
          let i = 0;
          for (const lg of LANGS.map((l) => l[0]).filter((c) => (row.langs || []).includes(c))) {
            const txt = fill(m.texts[lg], row); if (!txt) { miss.push(lname(lg) + " text empty"); continue; }
            const gl = row.voice === "both" ? ["female", "male"] : row.voice === "alt" ? [i % 2 ? "male" : "female"] : [row.voice || "female"];
            for (const g of gl) { const p = pick(lg, g); if (!p) { miss.push(lname(lg) + " voice missing"); continue; } if (!p.exact) miss.push(lname(lg) + " " + g + " voice missing (used " + p.v.name + ")"); await speakOne(txt, p.v, row.style || "command", vol, my); await wait(450, my); }
            i++;
          }
        }
        if (r < (row.repeat || 1) - 1) await wait(1500, my);
      }
    } catch (e) { miss.push(e.message || "error"); }
    finally { if (S.tok === my) { S.now = ""; paint(); } }
    try { await call("kmr_ann_log", { p_sched: row.id && /^[0-9a-f-]{36}$/.test(row.id) ? row.id : null, p_name: row.name, p_kind: kind, p_detail: miss.length ? "Problem: " + [...new Set(miss)].join("; ") : "Played" }); } catch (e) { /* log failure must not stop the announcer */ }
  }
  const enqueue = (row, kind) => { const g = S.gen; S.q = S.q.then(() => (g === S.gen ? runItem(row, kind) : null)).catch(() => {}); };
  function now(row, kind) { S.gen++; stopSound(); S.q = Promise.resolve(); enqueue(row, kind); }

  /* ---------- the clock: runs every second while the announcer is switched on ---------- */
  function loadFired() { try { S.fired = JSON.parse(localStorage.getItem("ann_fired_" + QP.slug) || "{}"); } catch (e) { S.fired = {}; } const t = ymd(new Date()); Object.keys(S.fired).forEach((k) => { if (!k.startsWith(t)) delete S.fired[k]; }); }
  const saveFired = () => { try { localStorage.setItem("ann_fired_" + QP.slug, JSON.stringify(S.fired)); } catch (e) { /* ignore */ } };
  function tick() {
    const n = new Date(), c = $("#clk"); if (c) c.textContent = n.toLocaleTimeString("en-IN", { hour12: true });
    if (!S.armed || !S.d) return;
    const hm = pad(n.getHours()) + ":" + pad(n.getMinutes()), dow = n.getDay() || 7, dk = ymd(n);
    for (const r of S.d.sched) { if (!r.enabled || !(r.days || []).includes(dow) || !(r.times || []).includes(hm)) continue; const k = dk + " " + hm + " " + r.id; if (S.fired[k]) continue; S.fired[k] = 1; saveFired(); enqueue(r, "auto"); }
  }
  setInterval(tick, 1000);
  setInterval(async () => { if (S.armed && !S.now) { try { S.d = await call("kmr_ann_load"); if (hashGo() === "air") paint(); } catch (e) { /* keep the last schedule */ } } }, 300000);
  async function arm() {
    if (!window.speechSynthesis) { say("This browser cannot speak. Open the app in Microsoft Edge or Chrome."); return; }
    try { S.d = await call("kmr_ann_load"); } catch (e) { say(e.message); return; }
    ac(); loadVoices(); try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
    loadFired(); S.armed = true; try { if (navigator.wakeLock) S.lock = await navigator.wakeLock.request("screen"); } catch (e) { /* screen may sleep: set Windows to never sleep */ }
    say("Announcer is ON. Keep this window open.", true); paint();
  }
  document.addEventListener("visibilitychange", async () => { if (S.armed && document.visibilityState === "visible" && navigator.wakeLock) { try { S.lock = await navigator.wakeLock.request("screen"); } catch (e) { /* ignore */ } } });
  function disarm() { S.armed = false; stopSound(); if (S.lock) { S.lock.release().catch(() => {}); S.lock = null; } say("Announcer is OFF. Nothing will play until you switch it on.", true); paint(); }

  function upcoming() {
    if (!S.d) return []; const n = new Date(), out = [];
    for (let d = 0; d < 2; d++) { const day = new Date(n.getFullYear(), n.getMonth(), n.getDate() + d), dow = day.getDay() || 7;
      S.d.sched.filter((r) => r.enabled && r.days.includes(dow)).forEach((r) => r.times.forEach((t) => { const [h, m] = t.split(":").map(Number), at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m); if (at > n) out.push({ at, r }); })); }
    return out.sort((a, b) => a.at - b.at).slice(0, 8);
  }
  function mname(r) { if (r.rec_id) { const a = (S.d.audio || []).find((x) => x.id === r.rec_id); return "🎙 " + (a ? a.name : "recording"); } const m = msgOf(r.msg_code); return m ? m.label : r.msg_code; }

  /* ---------- On air ---------- */
  function drawAir() {
    $("#air").innerHTML = `<div class="guide">Open this screen on the computer that is connected to the speakers, press <b>Switch announcer ON</b> once, and leave the window open. It speaks every announcement of the <b>Schedule</b> at its time. Set the computer to never sleep and its clock to the correct time.</div>
    <div class="onair"><div><div class="clock" id="clk">--:--:--</div><div class="mut" id="lampt"></div></div><div id="armbox"></div></div>
    <div class="now" id="nowbox"></div>
    <h3>Coming up</h3><div id="upc"></div>
    <h3>Emergency</h3><div class="guide">Press the red button to stop everything and speak the emergency message with a siren, at once. Choose the languages first.</div>
    <div class="row">${LANGS.map((l) => `<label class="chk"><input type="checkbox" class="el" value="${l[0]}" ${(localStorage.getItem("ann_el") || "hi,kn,en").split(",").includes(l[0]) ? "checked" : ""}> ${l[1]}</label>`).join("")}
      <select id="evo" style="width:auto"><option value="both">Female then male voice</option><option value="female">Female voice</option><option value="male">Male voice</option></select></div>
    <div class="row"><button class="btn red big2" id="emg">🚨 EMERGENCY ANNOUNCEMENT</button><button class="btn gr" id="clr">All clear</button><button class="btn o" id="stp">Stop sound</button></div>`;
    const el = () => [...document.querySelectorAll(".el:checked")].map((x) => x.value);
    document.querySelectorAll(".el").forEach((x) => (x.onchange = () => localStorage.setItem("ann_el", el().join(","))));
    const mk = (code, chime, rep) => ({ id: "manual", name: code === "emergency" ? "EMERGENCY (button)" : "ALL CLEAR (button)", msg_code: code, langs: el().length ? el() : ["en"], voice: V("evo"), style: "emergency", repeat: rep, chime, volume: 100 });
    $("#emg").onclick = () => { if (!S.armed) { say("Switch the announcer ON first."); return; } now(mk("emergency", "siren", 2), "emergency"); };
    $("#clr").onclick = () => { if (!S.armed) { say("Switch the announcer ON first."); return; } now(mk("all_clear", "bell", 1), "manual"); };
    $("#stp").onclick = () => { S.gen++; stopSound(); };
    paint(); tick();
  }
  function paint() {
    const a = $("#armbox"); if (!a) return;
    a.innerHTML = S.armed ? `<button class="btn o" id="off">Switch announcer OFF</button>` : `<button class="btn gr big2" id="on">▶ Switch announcer ON</button>`;
    const b = S.armed ? $("#off") : $("#on"); b.onclick = S.armed ? disarm : arm;
    $("#lampt").innerHTML = `<span class="lamp ${S.now ? "play" : S.armed ? "on" : ""}"></span>${S.now ? "Speaking now" : S.armed ? "ON AIR - waiting for the next time" : "OFF - nothing will play"}`;
    $("#nowbox").textContent = S.now ? "Now playing: " + S.now : "Nothing playing.";
    const u = upcoming(); $("#upc").innerHTML = u.length ? `<div class="tbl"><table><thead><tr><th>When</th><th>Announcement</th><th>Message</th><th>Languages</th></tr></thead><tbody>${u.map((x) => `<tr><td class="n">${x.at.toLocaleString("en-IN", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</td><td>${esc(x.r.name)}</td><td>${esc(mname(x.r))}</td><td>${x.r.rec_id ? "your voice" : esc(x.r.langs.map(lname).join(", "))}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${S.d ? "Nothing is scheduled. Open <b>Schedule</b> and add announcements." : "Press Switch announcer ON to load the schedule."}</div>`;
  }

  /* ---------- Schedule ---------- */
  const PRESET = [["Shift start", "shift_start", ["08:00"], null], ["Hourly report", "hourly", ["09:55", "10:55", "11:55", "12:55", "14:55", "15:55"], null], ["Tea break start", "break_start", ["10:30"], 15], ["Tea break end", "break_end", ["10:45"], null],
    ["Lunch start", "break_start", ["13:00"], 30], ["Lunch end", "break_end", ["13:30"], null], ["Afternoon tea start", "break_start", ["15:30"], 15], ["Afternoon tea end", "break_end", ["15:45"], null], ["Shift end warning", "shift_end_warn", ["16:50"], 10], ["Shift closed", "shift_end", ["17:00"], null]];
  function msgOptions(sel) { return `<optgroup label="Messages">${msgs().map((m) => `<option value="m:${esc(m.code)}" ${sel === "m:" + m.code ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</optgroup>` + ((S.d.audio || []).length ? `<optgroup label="My recorded voice">${S.d.audio.map((a) => `<option value="r:${a.id}" ${sel === "r:" + a.id ? "selected" : ""}>🎙 ${esc(a.name)}</option>`).join("")}</optgroup>` : ""); }
  function formVals() {
    const m = V("sm"), isRec = m.startsWith("r:");
    return { id: S.edit || null, name: V("sn"), enabled: V("sen"), times: V("st").split(/[\s,;]+/).filter(Boolean).map((t) => t.replace(/^(\d):/, "0$1:")), days: [...document.querySelectorAll(".sd:checked")].map((x) => +x.value),
      msg_code: isRec ? null : m.slice(2), rec_id: isRec ? m.slice(2) : null, langs: [...document.querySelectorAll(".sl:checked")].map((x) => x.value), voice: V("sv"), style: V("sy"), repeat: +V("sr") || 1, chime: V("sc"), mins: V("smn") === "" ? null : +V("smn"), volume: +V("svol") || 100 };
  }
  function drawSch() {
    const rows = S.d.sched, e = S.edit && rows.find((r) => r.id === S.edit), r = e || { name: "", enabled: true, times: [], days: [1, 2, 3, 4, 5, 6], msg_code: "hourly", rec_id: null, langs: ["en", "hi", "kn"], voice: "female", style: "command", repeat: 1, chime: "bell", mins: null, volume: 100 };
    const sel = r.rec_id ? "r:" + r.rec_id : "m:" + r.msg_code;
    $("#sch").innerHTML = `<div class="guide">Each line is one announcement: <b>what</b> to say, <b>at which times</b>, on <b>which days</b>, in <b>which languages</b> and which <b>voice</b>. Times are in 24-hour form (for example 14:55). Languages are spoken one after the other in the order shown.</div>
    ${ed() ? `<div class="mcard"><b>${e ? "Change announcement" : "New announcement"}</b>
      <div class="frm" style="margin-top:8px"><div><span class="lbl">Name</span><input id="sn" value="${esc(r.name)}" placeholder="Hourly report"></div>
        <div><span class="lbl">What to say</span><select id="sm">${msgOptions(sel)}</select></div>
        <div><span class="lbl">Minutes (only for break / shift-end messages)</span><input id="smn" type="number" min="1" max="600" value="${r.mins == null ? "" : r.mins}" placeholder="15"></div>
        <div><span class="lbl">Voice</span><select id="sv"><option value="female" ${r.voice === "female" ? "selected" : ""}>Female</option><option value="male" ${r.voice === "male" ? "selected" : ""}>Male</option><option value="both" ${r.voice === "both" ? "selected" : ""}>Female, then male (each language)</option><option value="alt" ${r.voice === "alt" ? "selected" : ""}>Alternate female / male by language</option></select></div>
        <div><span class="lbl">Style</span><select id="sy">${Object.entries(STYLE).map(([k, v]) => `<option value="${k}" ${r.style === k ? "selected" : ""}>${v.label}</option>`).join("")}</select></div>
        <div><span class="lbl">Sound before the voice</span><select id="sc"><option value="bell" ${r.chime === "bell" ? "selected" : ""}>Attention bell</option><option value="siren" ${r.chime === "siren" ? "selected" : ""}>Siren (4 seconds)</option><option value="none" ${r.chime === "none" ? "selected" : ""}>None</option></select></div>
        <div><span class="lbl">Repeat</span><select id="sr">${[1, 2, 3, 4, 5].map((n) => `<option ${r.repeat === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div><span class="lbl">Volume (10 to 100)</span><input id="svol" type="number" min="10" max="100" step="5" value="${r.volume}"></div></div>
      <div style="margin-top:8px"><span class="lbl">Times (separate with comma or space)</span><textarea id="st" rows="2" placeholder="09:55, 10:55, 11:55">${esc((r.times || []).join(", "))}</textarea>
        <div class="row" style="margin-top:6px"><span class="mut">Every hour:</span> from <input id="hf" type="number" min="0" max="23" value="9" style="width:70px"> to <input id="ht" type="number" min="0" max="23" value="17" style="width:70px"> at minute <input id="hm" type="number" min="0" max="59" value="55" style="width:70px"><button class="btn o sm" id="hgo" type="button">Fill the times</button></div></div>
      <div style="margin-top:8px"><span class="lbl">Days</span>${DAYS.map((d) => `<label class="chk"><input type="checkbox" class="sd" value="${d[0]}" ${(r.days || []).includes(d[0]) ? "checked" : ""}> ${d[1]}</label>`).join("")}</div>
      <div style="margin-top:8px" id="lgbox"><span class="lbl">Languages</span>${LANGS.map((l) => `<label class="chk"><input type="checkbox" class="sl" value="${l[0]}" ${(r.langs || []).includes(l[0]) ? "checked" : ""}> ${l[1]} <span class="mut">${l[2]}</span></label>`).join("")}</div>
      <div class="row" style="margin-top:10px"><label class="chk"><input type="checkbox" id="sen" ${r.enabled ? "checked" : ""}> Switched on</label><button class="btn" id="ssave">${e ? "Save changes" : "Add to schedule"}</button>${e ? `<button class="btn o" id="scancel">Cancel</button>` : ""}<button class="btn o" id="stest">▶ Play this now (test)</button></div></div>` : `<div class="guide">You can view the schedule. Ask your administrator for editor access to change it.</div>`}
    ${rows.length ? "" : `<div class="empty">No announcements yet.${ed() ? `<br><button class="btn" id="spre" style="margin-top:8px">Add a typical day to start with (then change the times)</button>` : ""}</div>`}
    ${rows.length ? `<div class="tbl"><table><thead><tr><th class="n">S.No</th><th>On</th><th>Name</th><th>Times</th><th>Days</th><th>Message</th><th>Languages</th><th>Voice · style</th><th></th></tr></thead><tbody>${rows.map((x, i) => `<tr><td>${i + 1}</td><td><span class="chip ${x.enabled ? "g" : "x"}">${x.enabled ? "On" : "Off"}</span></td><td>${esc(x.name)}</td><td>${esc(x.times.join(", "))}</td><td>${x.days.length === 7 ? "Every day" : esc(x.days.map((d) => DAYS[d - 1][1]).join(" "))}</td><td>${esc(mname(x))}${x.mins != null ? " · " + x.mins + " min" : ""}</td><td>${x.rec_id ? "your voice" : esc(x.langs.map(lname).join(", "))}</td><td>${esc(x.voice)} · ${esc(x.style)} · ${esc(x.chime)} · ×${x.repeat}</td><td class="n"><button class="btn o sm" data-pl="${x.id}">▶</button>${ed() ? ` <button class="btn o sm" data-ed="${x.id}">Edit</button> <button class="btn d sm" data-dl="${x.id}">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
    const sm = $("#sm"); if (sm) { const tg = () => ($("#lgbox").style.display = sm.value.startsWith("r:") ? "none" : ""); sm.onchange = tg; tg(); }
    if ($("#hgo")) $("#hgo").onclick = () => { const f = +V("hf"), t = +V("ht"), m = +V("hm"), a = []; for (let h = f; h <= t; h++) a.push(pad(h) + ":" + pad(m)); $("#st").value = a.join(", "); };
    if ($("#ssave")) $("#ssave").onclick = async () => { try { S.d = await call("kmr_ann_sched_save", { p: formVals() }); S.edit = null; say("Saved.", true); drawSch(); } catch (x) { say(x.message); } };
    if ($("#scancel")) $("#scancel").onclick = () => { S.edit = null; drawSch(); };
    if ($("#stest")) $("#stest").onclick = () => { if (!S.armed) { say("Switch the announcer ON (On air screen) to play a test."); return; } now(Object.assign(formVals(), { id: "test", name: V("sn") || "Test" }), "test"); };
    if ($("#spre")) $("#spre").onclick = async () => { try { const lg = formVals().langs; for (const p of PRESET) S.d = await call("kmr_ann_sched_save", { p: { name: p[0], enabled: true, times: p[2], days: [1, 2, 3, 4, 5, 6], msg_code: p[1], rec_id: null, langs: lg.length ? lg : ["en", "hi", "kn"], voice: "female", style: "command", repeat: 1, chime: "bell", mins: p[3], volume: 100 } }); say("Added. Now change the times to match your shifts.", true); drawSch(); } catch (x) { say(x.message); } };
    document.querySelectorAll("[data-ed]").forEach((b) => (b.onclick = () => { S.edit = b.dataset.ed; drawSch(); window.scrollTo(0, 0); }));
    document.querySelectorAll("[data-pl]").forEach((b) => (b.onclick = () => { if (!S.armed) { say("Switch the announcer ON (On air screen) to play a test."); return; } const x = S.d.sched.find((q) => q.id === b.dataset.pl); now(x, "test"); }));
    document.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = async () => { const x = S.d.sched.find((q) => q.id === b.dataset.dl), why = await sureDelete("the announcement \"" + x.name + "\""); if (!why) return; try { S.d = await call("kmr_ann_sched_del", { p_id: x.id, p_reason: why }); say("Deleted. The reason is kept in the change log.", true); drawSch(); } catch (e) { say(e.message); } }));
  }
  /* every delete: two warnings, then the reason (kept in the permanent change log) */
  async function sureDelete(what) {
    if (!(await KMRDlg.yes("Delete " + what + "?"))) return null;
    if (!(await KMRDlg.yes("FINAL WARNING. Deleting " + what + " cannot be undone. Delete it?"))) return null;
    const why = await KMRDlg.ask("Why is it being deleted? (kept in the change log with your name, date and time)", ""); if (why === null) return null;
    if (String(why).trim().length < 3) { say("Write the reason (at least 3 letters). Nothing was deleted."); return null; } return String(why).trim();
  }

  /* ---------- Messages ---------- */
  function drawMess() {
    const list = msgs();
    $("#mess").innerHTML = `<div class="guide">These are the sentences that are spoken. Each can be changed in any language. Write <b>{mins}</b> where the minutes should be spoken. <b>Please ask a person who speaks each language to listen once and correct the wording</b> before using it on the shop floor.</div>
    <div class="row"><span class="lbl" style="margin:0">Play test with</span><select id="tg" style="width:auto"><option value="female">Female voice</option><option value="male">Male voice</option></select></div>
    ${list.map((m) => `<div class="mcard" data-c="${esc(m.code)}"><div class="row"><b class="grow">${esc(m.label)}</b>${ed() ? `<button class="btn sm" data-sv="${esc(m.code)}">Save this message</button>` : ""}</div>
      <div class="lg">${LANGS.map((l) => `<div><span class="lbl">${l[1]} ${l[2]} <button class="btn o sm" data-ts="${esc(m.code)}|${l[0]}" type="button">▶</button></span><textarea data-l="${l[0]}" ${ed() ? "" : "readonly"}>${esc(m.texts[l[0]] || "")}</textarea></div>`).join("")}</div></div>`).join("")}
    ${ed() ? `<div class="mcard"><b>Add your own message</b><div class="frm" style="margin:8px 0"><div><span class="lbl">Message name</span><input id="nn" placeholder="Visitor alert"></div></div><div class="lg">${LANGS.map((l) => `<div><span class="lbl">${l[1]} ${l[2]}</span><textarea id="nt_${l[0]}"></textarea></div>`).join("")}</div><div class="row" style="margin-top:8px"><button class="btn" id="nadd">Add message</button></div></div>` : ""}`;
    document.querySelectorAll("[data-sv]").forEach((b) => (b.onclick = async () => { const c = b.dataset.sv, card = b.closest(".mcard"), t = {}; card.querySelectorAll("textarea").forEach((x) => (t[x.dataset.l] = x.value.trim())); const m = msgOf(c); try { S.d = await call("kmr_ann_msg_save", { p_code: c, p_label: m.label, p_texts: t }); say("Saved. The change is in the change log.", true); } catch (e) { say(e.message); } }));
    document.querySelectorAll("[data-ts]").forEach((b) => (b.onclick = () => { const [c, l] = b.dataset.ts.split("|"), txt = b.closest(".mcard").querySelector(`textarea[data-l=${l}]`).value; testSay(l, V("tg"), fill(txt, { mins: 15 })); }));
    if ($("#nadd")) $("#nadd").onclick = async () => { const t = {}; LANGS.forEach((l) => (t[l[0]] = V("nt_" + l[0]).trim())); const n = V("nn").trim(); try { S.d = await call("kmr_ann_msg_save", { p_code: "c_" + n, p_label: n, p_texts: t }); say("Added. Choose it in the Schedule.", true); drawMess(); } catch (e) { say(e.message); } };
  }
  async function testSay(lang, g, text) {
    if (!window.speechSynthesis) { say("This browser cannot speak."); return; } loadVoices(); const p = pick(lang, g);
    if (!p) { say("No " + lname(lang) + " voice on this computer. See the Voice check screen."); return; } if (!p.exact) say("No " + g + " " + lname(lang) + " voice here; using " + p.v.name + ".");
    const my = ++S.tok; try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } await speakOne(text, p.v, "command", 1, my);
  }

  /* ---------- My voice (record or upload) ---------- */
  function drawRec() {
    const a = S.d.audio || [];
    $("#rec").innerHTML = `<div class="guide">Record your own announcement with the microphone (up to 60 seconds), listen to it, give it a name and save. Then choose it in the <b>Schedule</b> under "What to say". You can also upload an audio file (mp3, m4a, wav, webm; under 1 MB).</div>
    ${ed() ? `<div class="mcard"><div class="row"><button class="btn red" id="rst">● Start recording</button><button class="btn o" id="rsp" disabled>■ Stop</button><span id="rtm" class="mut"></span><span id="rdot"></span></div>
      <div class="row"><input type="file" id="rfile" accept="audio/*" style="width:auto"></div>
      <div id="rprev"></div></div>` : ""}
    ${a.length ? `<div class="tbl"><table><thead><tr><th class="n">S.No</th><th>Name</th><th>Length</th><th>Saved by</th><th>When</th><th></th></tr></thead><tbody>${a.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${x.secs ? Math.round(x.secs) + " s" : ""}</td><td>${esc(x.by || "")}</td><td>${dt(x.at)}</td><td class="n"><button class="btn o sm" data-ap="${x.id}">▶ Play</button>${ed() ? ` <button class="btn d sm" data-ad="${x.id}">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No recordings yet.</div>`}`;
    let mr = null, chunks = [], t0 = 0, iv = 0, stream = null;
    const showPrev = (blob, secs, nm) => { S.recBlob = { blob, secs }; const url = URL.createObjectURL(blob); $("#rprev").innerHTML = `<audio controls src="${url}" style="width:100%;margin-top:8px"></audio><div class="row" style="margin-top:8px"><input id="rnm" placeholder="Name, for example Tea time call" value="${esc(nm || "")}" class="grow"><button class="btn" id="rsave">Save recording</button></div>`; $("#rsave").onclick = saveRec; };
    async function saveRec() {
      const nm = V("rnm").trim(); if (!nm) { say("Give the recording a name."); return; } const { blob, secs } = S.recBlob;
      const b64 = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(",")[1]); f.onerror = rej; f.readAsDataURL(blob); });
      try { S.d = await call("kmr_ann_audio_save", { p_name: nm, p_mime: (blob.type || "audio/webm").split(";")[0], p_b64: b64, p_secs: secs }); S.recBlob = null; say("Saved.", true); drawRec(); } catch (e) { say(e.message); }
    }
    if ($("#rst")) {
      $("#rst").onclick = async () => {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { say("The microphone is blocked. Allow the microphone for this site in the browser, then try again."); return; }
        chunks = []; mr = new MediaRecorder(stream, { audioBitsPerSecond: 48000 }); mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        mr.onstop = () => { clearInterval(iv); stream.getTracks().forEach((t) => t.stop()); $("#rdot").innerHTML = ""; $("#rst").disabled = false; $("#rsp").disabled = true; const secs = (Date.now() - t0) / 1000; showPrev(new Blob(chunks, { type: mr.mimeType || "audio/webm" }), secs, ""); };
        mr.start(); t0 = Date.now(); $("#rst").disabled = true; $("#rsp").disabled = false; $("#rdot").innerHTML = `<span class="rec"></span> recording`;
        iv = setInterval(() => { const s = (Date.now() - t0) / 1000; $("#rtm").textContent = s.toFixed(0) + " s"; if (s >= 60) mr.stop(); }, 250);
      };
      $("#rsp").onclick = () => mr && mr.state !== "inactive" && mr.stop();
      $("#rfile").onchange = (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 1000000) { say("The file is too big. Keep it under 1 MB."); return; } const au = new Audio(URL.createObjectURL(f)); au.onloadedmetadata = () => showPrev(f, au.duration || 0, f.name.replace(/\.[^.]+$/, "")); au.onerror = () => showPrev(f, 0, f.name.replace(/\.[^.]+$/, "")); };
    }
    document.querySelectorAll("[data-ap]").forEach((b) => (b.onclick = async () => { const my = ++S.tok; try { await clip(b.dataset.ap, 1, my); } catch (e) { say(e.message); } }));
    document.querySelectorAll("[data-ad]").forEach((b) => (b.onclick = async () => { const x = a.find((q) => q.id === b.dataset.ad), why = await sureDelete("the recording \"" + x.name + "\""); if (!why) return; try { S.d = await call("kmr_ann_audio_del", { p_id: x.id, p_reason: why }); delete S.cache[x.id]; say("Deleted. The reason is kept in the change log.", true); drawRec(); } catch (e) { say(e.message); } }));
  }

  /* ---------- Voice check ---------- */
  function drawVc() {
    loadVoices(); const rows = LANGS.map((l) => ({ l, f: pick(l[0], "female"), m: pick(l[0], "male") })), ok = rows.reduce((n, r) => n + (r.f && r.f.exact ? 1 : 0) + (r.m && r.m.exact ? 1 : 0), 0);
    const cell = (p, l, g) => p && p.exact ? `<span class="ok">✔ ${esc(p.v.name)}</span> <button class="btn o sm" data-vt="${l}|${g}">▶ Test</button>` : p ? `<span class="no">✘ no ${g} voice</span> (would use ${esc(p.v.name)}) <button class="btn o sm" data-vt="${l}|${g}">▶ Test</button>` : `<span class="no">✘ not on this computer</span>`;
    $("#vc").innerHTML = `<div class="guide">The voices are on the computer that plays the announcements. <b>${ok} of 14</b> voices are ready on this computer. <b>Microsoft Edge on Windows 10 / 11</b> has free natural voices for all 7 languages, male and female. Where a voice is missing, use <b>My voice</b> (your own recording) for that language, or use Edge.</div>
    <div class="tbl"><table><thead><tr><th>Language</th><th>Female voice</th><th>Male voice</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${r.l[1]}</b> <span class="mut">${r.l[2]}</span></td><td>${cell(r.f, r.l[0], "female")}</td><td>${cell(r.m, r.l[0], "male")}</td></tr>`).join("")}</tbody></table></div>
    <p class="mut">Browser: ${esc(navigator.userAgent.replace(/\).*/, ")"))} · ${VOICES.length} voices found. If you just opened this page, wait a few seconds and reopen this screen.</p>`;
    document.querySelectorAll("[data-vt]").forEach((b) => (b.onclick = () => { const [l, g] = b.dataset.vt.split("|"), m = msgOf("shift_start"); testSay(l, g, fill((m && m.texts[l]) || "", {})); }));
  }

  /* ---------- Logs ---------- */
  function drawLog() {
    const L = S.d.log, A = S.d.audit;
    $("#log").innerHTML = `<div class="guide">Two permanent records: what was <b>played</b> (when, which announcement, any problem) and every <b>change</b> (who changed or deleted what, when, and why). Latest first, last 200 of each.</div>
    <h3>Played</h3>${L.length ? `<div class="tbl"><table><thead><tr><th class="n">S.No</th><th>When</th><th>Announcement</th><th>How</th><th>Result</th><th>Computer user</th></tr></thead><tbody>${L.map((r, i) => `<tr><td>${i + 1}</td><td class="n">${dt(r.at)}</td><td>${esc(r.name)}</td><td>${esc(r.kind)}</td><td>${/^Problem/.test(r.detail || "") ? `<span class="no">${esc(r.detail)}</span>` : esc(r.detail || "")}</td><td>${esc(r.email || "")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Nothing has played yet.</div>`}
    <h3>Changes</h3>${A.length ? `<div class="tbl"><table><thead><tr><th class="n">S.No</th><th>When</th><th>Who</th><th>What</th><th>Item</th><th>Reason</th></tr></thead><tbody>${A.map((r, i) => `<tr><td>${i + 1}</td><td class="n">${dt(r.at)}</td><td>${esc(r.email || "")}</td><td>${esc(r.action)}</td><td>${esc(r.what || "")}</td><td>${esc(r.reason || "")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No changes yet.</div>`}`;
  }

  /* ---------- screens ---------- */
  async function route() {
    const go = hashGo();
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === go));
    ["std", "air", "sch", "mess", "rec", "vc", "log"].forEach((s) => $("#" + s).classList.toggle("hide", s !== go));
    if (go === "std") return KMRStd.draw($("#std"), "announce");
    if (go === "vc") return drawVc();
    try { if (!S.armed || !S.d || go === "log") S.d = await call("kmr_ann_load"); ({ air: drawAir, sch: drawSch, mess: drawMess, rec: drawRec, log: drawLog })[go](); } catch (e) { say(e.message); }
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", (e) => { if (S.armed) { e.preventDefault(); e.returnValue = ""; } });
  (async () => { try { await QP.init("announce"); if (!QP.ctx) return; $("#role").textContent = QP.ctx.role; route(); } catch (e) { say(e.message); } })();
})();
