/* Raw material daily stock — desktop month screen: opening stock, daily received / issued, closing and current balance; view, edit, delete. Mobile entry: /it/rmstock.html */
(function () {
  "use strict";
  const { $, esc, say, call } = QP;
  const n = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
  const ist = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  const dmy = (s) => String(s).slice(0, 10).split("-").reverse().join("/");
  const KL = { in: "Received", out: "Issued", opening: "Opening stock" };
  /* every delete asks twice, then asks the reason; every edit asks the reason: all are written to the permanent stock log */
  async function sureDelete(what) {
    if (!await KMRDlg.yes("DELETE this entry?\n" + what + "\nThe stock balance will change.")) return null;
    if (!await KMRDlg.yes("FINAL WARNING: are you really sure?\nThe deletion is recorded in the stock log with your name, date and time and cannot be undone.")) return null;
    const r = await KMRDlg.ask("Reason for deleting (required):", "");
    if (r === null || r.trim().length < 3) { say("A reason is required. Nothing was deleted."); return null; }
    return r.trim();
  }
  async function askWhy(text) {
    const r = await KMRDlg.ask(text, "");
    if (r === null || r.trim().length < 3) { say("A reason is required. Nothing was changed."); return null; }
    return r.trim();
  }
  const S = { d: null, month: null, sel: null, edit: null, tx: [], el: null };

  async function draw(el, month) {
    S.el = el; S.month = month;
    S.d = await call("kmr_rm_month", { p_month: month });
    if (S.sel && !S.d.materials.some((m) => m.code === S.sel)) S.sel = null;
    await paint(); syncOpen();
  }

  /* the browser can put back an old value in a typed box after a page refresh (it remembers what the box held last time): the saved opening stock always wins */
  function syncOpen() {
    const put = () => document.querySelectorAll("td[data-op] input.opin").forEach((i) => { if (document.activeElement === i) return; const v = Number(i.closest("td").dataset.v); if (num(i.value) !== v) i.value = n(v); });
    put(); [150, 600, 1500, 3500].forEach((ms) => setTimeout(put, ms));
  }
  window.addEventListener("pageshow", (e) => { if (e.persisted && S.el && S.month) draw(S.el, S.month).catch(() => {}); });

  async function paint() {
    const d = S.d, [y, mo] = S.month.split("-").map(Number), nd = new Date(y, mo, 0).getDate(), days = Array.from({ length: nd }, (_, i) => `${S.month}-${String(i + 1).padStart(2, "0")}`);
    const can = d.can_edit;
    const rows = d.materials.map((m) => {
      const by = {}; m.days.forEach((x) => { by[String(x.d).slice(0, 10)] = x; });
      const ti = m.days.reduce((a, x) => a + Number(x.in), 0), to = m.days.reduce((a, x) => a + Number(x.out), 0), cl = Number(m.opening) + ti - to;
      return { m, by, ti, to, cl };
    });
    const cell = (x) => !x ? '<td class="num mut">·</td>' : `<td class="num" style="line-height:1.15">${Number(x.in) ? `<span style="color:#16a34a">+${n(x.in)}</span>` : ""}${Number(x.in) && Number(x.out) ? "<br>" : ""}${Number(x.out) ? `<span style="color:#dc2626">−${n(x.out)}</span>` : ""}</td>`;
    S.el.innerHTML = `<div class="row noprint"><h3 style="margin:0">${esc((d.unit || "").replace("‑", "-"))} · Raw material stock · ${esc(S.month)}</h3><span class="grow"></span>${can ? '<button type="button" class="btn sm" id="rmsaveall" style="background:#16a34a;color:#fff;border:0;font-weight:700">Save opening stock</button> ' : ""}<a class="btn o sm" href="/it/rmstock.html?co=${encodeURIComponent(QP.slug)}" target="_blank">Mobile entry screen</a></div>
    <p class="note">Quantities are typed on the mobile screen (or here). Green = received, red = issued. Type the opening stock straight in the Opening column; it saves when you leave the box or press Enter, and the Save opening stock button saves everything at once. Click a material name to see, edit or delete its entries. Closing = opening + received − issued; the current balance feeds the planning screens and the evening report.</p>
    <div class="rmp-sc"><table class="lt"><thead><tr><th style="position:sticky;left:0;z-index:4;background:#EEF2F8">Part</th><th>Material spec</th><th>Unit</th><th class="num">Opening</th>${days.map((x) => `<th class="num" style="min-width:58px">${x.slice(8)}</th>`).join("")}<th class="num">Received</th><th class="num">Issued</th><th class="num">Closing</th><th class="num">Current balance</th></tr></thead><tbody>
    ${rows.length ? rows.map((r) => `<tr data-mat="${esc(r.m.code)}" style="cursor:pointer;${S.sel === r.m.code ? "background:#e0f2fe;color:#000" : ""}"><td style="position:sticky;left:0;background:${S.sel === r.m.code ? "#e0f2fe" : "var(--card)"};font-weight:700">${esc(r.m.code)}</td><td>${esc(r.m.spec || "")}</td><td>${esc(r.m.unit)}</td><td class="num" data-op="${esc(r.m.code)}" data-v="${Number(r.m.opening)}">${can ? `<input class="opin" type="text" inputmode="decimal" autocomplete="off" value="${n(r.m.opening)}" title="Type the opening stock; it saves when you leave the box or press Enter" style="width:92px;height:26px;box-sizing:border-box;margin:0;padding:0 6px;text-align:right;font:inherit;font-weight:700;color:#0e7490;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc"><span style="display:none">${n(r.m.opening)}</span>` : n(r.m.opening)}</td>${days.map((x) => cell(r.by[x])).join("")}<td class="num" style="color:#16a34a">${n(r.ti)}</td><td class="num" style="color:#dc2626">${n(r.to)}</td><td class="num"><b>${n(r.cl)}</b></td><td class="num"><b>${n(r.m.current)}</b></td></tr>`).join("") : `<tr><td colspan="${days.length + 7}" class="mut">No materials yet. Add them in Materials &amp; BOM first.</td></tr>`}
    </tbody></table></div><div id="rmdet"></div>`;
    await detail();
  }

  async function detail() {
    const box = $("#rmdet"); if (!box) return;
    if (!S.sel) { box.innerHTML = '<p class="note">Click a material above to see and edit its entries.</p>'; return; }
    const [y, mo] = S.month.split("-").map(Number), to = `${S.month}-${String(new Date(y, mo, 0).getDate()).padStart(2, "0")}`;
    S.tx = await call("kmr_rm_txns", { p_from: `${S.month}-01`, p_to: to, p_material: S.sel });
    const can = S.d.can_edit, e = S.edit || { id: "", kind: "in", qty: "", txn_date: ist(), ref: "", remarks: "" };
    const opn = await call("kmr_rm_txns", { p_from: "2000-01-01", p_to: `${S.month}-01`, p_material: S.sel });
    const op = opn.filter((x) => x.kind === "opening");
    box.innerHTML = `<div class="box"><h3>${esc(S.sel)} — entries in ${esc(S.month)}</h3>
    ${can ? `<div class="frm" id="rmf"><div><label>Type</label><select id="rk"><option value="in" ${e.kind === "in" ? "selected" : ""}>Received</option><option value="out" ${e.kind === "out" ? "selected" : ""}>Issued</option><option value="opening" ${e.kind === "opening" ? "selected" : ""}>Opening stock</option></select></div>
      <div><label>Date</label><input id="rd" type="date" max="${ist()}" value="${esc(String(e.txn_date).slice(0, 10))}"></div><div><label>Quantity</label><input id="rq" type="number" step="any" min="0" value="${esc(e.qty)}"></div>
      <div><label>Reference (GRN / slip no.)</label><input id="rr" value="${esc(e.ref || "")}"></div><div><label>Remarks</label><input id="rm" value="${esc(e.remarks || "")}"></div>
      <div style="align-self:end"><button class="btn" data-rs="save">${e.id ? "Save changes" : "Add entry"}</button> ${e.id ? '<button class="btn o" data-rs="cancel">Cancel</button>' : ""}</div></div>` : '<p class="mut">You can view stock but not change it.</p>'}
    <div class="sc"><table class="lt"><thead><tr><th>Date</th><th>Type</th><th class="num">Quantity</th><th>Reference</th><th>Remarks</th><th>Entered by</th>${can ? "<th></th>" : ""}</tr></thead><tbody>
    ${[...op.map((x) => ({ ...x, earlier: true })), ...S.tx].map((x) => `<tr><td>${dmy(x.txn_date)}</td><td>${KL[x.kind]}</td><td class="num">${x.kind === "out" ? "−" : x.kind === "in" ? "+" : ""}${n(x.qty)}</td><td>${esc(x.ref || "")}</td><td>${esc(x.remarks || "")}</td><td class="mut">${esc(x.entered_by || "")}</td>${can ? `<td><button class="btn o sm" data-re="${x.id}">Edit</button> <button class="btn o sm" data-rd="${x.id}" style="color:#dc2626;border-color:#dc2626">Delete</button></td>` : ""}</tr>`).join("") || '<tr><td colspan="7" class="mut">No entries.</td></tr>'}
    </tbody></table></div></div>`;
    try {
      const lg = await call("kmr_rm_log", { p_from: `${S.month}-01`, p_to: to, p_material: S.sel });
      box.innerHTML += `<div class="box"><h3>Stock log · ${esc(S.sel)} · ${esc(S.month)}</h3><p class="note">Every inward, outward, opening stock, edit, delete and stock correction, with date, time, person and reason. It cannot be changed or deleted.</p>
      <div class="sc"><table class="lt"><thead><tr><th>Date and time (India)</th><th>What happened</th><th>Entry date</th><th class="num">Qty before</th><th class="num">Qty after</th><th>Reference</th><th>Reason</th><th>Done by</th><th>Log ID</th></tr></thead><tbody>
      ${lg.length ? lg.map((x) => `<tr><td>${esc(x.at_ist)}</td><td><b>${esc(x.action)}</b> · ${esc(KL[x.kind] || "")}</td><td>${x.txn_date ? dmy(x.txn_date) : ""}</td><td class="num">${x.qty_before == null ? "" : n(x.qty_before)}</td><td class="num">${x.qty_after == null ? "" : n(x.qty_after)}</td><td>${esc(x.ref || "")}</td><td>${esc(x.reason || "")}</td><td class="mut">${esc(x.by_email || "")}</td><td class="mut">${x.id}</td></tr>`).join("") : '<tr><td colspan="9" class="mut">No log entries in this month.</td></tr>'}
      </tbody></table></div></div>`;
    } catch (e) { /* log shown when available */ }
  }

  document.addEventListener("click", async (ev) => {
    const t = ev.target; if (!$("#rmdet")) return;
    try {
      if (t.classList && t.classList.contains("opin")) return;
      const tr = t.closest("tr[data-mat]");
      if (tr && !t.closest("button")) { S.sel = tr.dataset.mat; S.edit = null; await paint(); return; }
      const re = t.closest("[data-re]"); if (re) { const all = await call("kmr_rm_txns", { p_from: "2000-01-01", p_to: ist(), p_material: S.sel }); S.edit = all.find((x) => x.id === re.dataset.re) || null; await detail(); $("#rmf") && $("#rmf").scrollIntoView({ block: "nearest" }); return; }
      const rd = t.closest("[data-rd]"); if (rd) { const x = S.tx.find((z) => z.id === rd.dataset.rd) || {}; const why = await sureDelete(`${S.sel} · ${KL[x.kind] || ""} ${n(x.qty)} · ${dmy(x.txn_date || ist())}`); if (!why) return; await call("kmr_rm_delete", { p_id: rd.dataset.rd, p_reason: why }); S.edit = null; say("Deleted.", true); await draw(S.el, S.month); return; }
      const rs = t.closest("[data-rs]"); if (!rs) return;
      if (rs.dataset.rs === "cancel") { S.edit = null; await detail(); return; }
      const q = Number($("#rq").value); if (!(q > 0)) return say("Type the quantity.");
      let why = null; if (S.edit) { why = await askWhy(`Correcting this entry (was ${KL[S.edit.kind]} ${n(S.edit.qty)}, now ${KL[$("#rk").value]} ${n(q)}).\nReason for the correction (required, kept in the stock log):`); if (!why) return; }
      await call("kmr_rm_save", { p: { id: S.edit ? S.edit.id : null, material_code: S.sel, kind: $("#rk").value, qty: q, txn_date: $("#rd").value, ref: $("#rr").value, remarks: $("#rm").value }, p_reason: why });
      S.edit = null; say("Saved.", true); await draw(S.el, S.month);
    } catch (e) { say(e.message); }
  });

  const num = (v) => Number(String(v).replace(/,/g, ""));
  async function saveOpening(inp) {
    const td = inp.closest("[data-op]"), was = Number(td.dataset.v), v = num(inp.value);
    if (inp.value.trim() === "" || !(v >= 0)) { inp.value = n(was); return false; }
    if (v === was) { inp.value = n(was); return false; }
    try {
      if (!await KMRDlg.yes(`Change opening stock of ${td.dataset.op} from ${n(was)} to ${n(v)}?\nThis is a stock correction and is recorded in the stock log.`)) { inp.value = n(was); return false; }
      const why = await askWhy("Reason for changing the opening stock (required):"); if (!why) { inp.value = n(was); return false; }
      await call("kmr_rm_set_opening", { p_material: td.dataset.op, p_month: S.month, p_qty: v, p_reason: why });
      S.d = await call("kmr_rm_month", { p_month: S.month });
      const m = S.d.materials.find((x) => x.code === td.dataset.op), c = td.parentElement.cells;
      if (m) {
        const ti = m.days.reduce((a, x) => a + Number(x.in), 0), to = m.days.reduce((a, x) => a + Number(x.out), 0), o = Number(m.opening);
        td.dataset.v = o; inp.value = n(o); inp.nextElementSibling.textContent = n(o); c[c.length - 2].textContent = n(o + ti - to); c[c.length - 1].textContent = n(m.current);
      }
      inp.style.background = "#dcfce7"; setTimeout(() => { inp.style.background = "#f8fafc"; }, 1200);
      return true;
    } catch (e) { inp.value = n(was); say(e.message); return false; }
  }
  document.addEventListener("focusin", (ev) => { if (ev.target.classList && ev.target.classList.contains("opin")) ev.target.select(); });
  document.addEventListener("keydown", (ev) => { const t = ev.target; if (t.classList && t.classList.contains("opin")) { if (ev.key === "Enter") { ev.preventDefault(); t.blur(); } else if (ev.key === "Escape") { t.value = n(t.closest("[data-op]").dataset.v); t.blur(); } } });
  document.addEventListener("change", async (ev) => { if (ev.target.classList && ev.target.classList.contains("opin")) { if (await saveOpening(ev.target)) say("Opening stock saved.", true); } });
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("#rmsaveall"); if (!b) return;
    let k = 0, bad = 0;
    for (const inp of document.querySelectorAll("input.opin")) { const td = inp.closest("[data-op]"); if (num(inp.value) !== Number(td.dataset.v)) { if (await saveOpening(inp)) k++; else bad++; } }
    say(k ? `Saved opening stock for ${k} material${k > 1 ? "s" : ""}.` : bad ? "Some entries could not be saved." : "All opening stock is already saved.", !bad);
  });
  window.RMStock = { draw };
})();
