/* Raw material daily stock — desktop month screen: opening stock, daily received / issued, closing and current balance; view, edit, delete. Mobile entry: /it/rmstock.html */
(function () {
  "use strict";
  const { $, esc, say, call } = QP;
  const n = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
  const ist = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  const dmy = (s) => String(s).slice(0, 10).split("-").reverse().join("/");
  const KL = { in: "Received", out: "Issued", opening: "Opening stock" };
  const S = { d: null, month: null, sel: null, edit: null, tx: [], el: null };

  async function draw(el, month) {
    S.el = el; S.month = month;
    S.d = await call("kmr_rm_month", { p_month: month });
    if (S.sel && !S.d.materials.some((m) => m.code === S.sel)) S.sel = null;
    await paint();
  }

  async function paint() {
    const d = S.d, [y, mo] = S.month.split("-").map(Number), nd = new Date(y, mo, 0).getDate(), days = Array.from({ length: nd }, (_, i) => `${S.month}-${String(i + 1).padStart(2, "0")}`);
    const can = d.can_edit;
    const rows = d.materials.map((m) => {
      const by = {}; m.days.forEach((x) => { by[String(x.d).slice(0, 10)] = x; });
      const ti = m.days.reduce((a, x) => a + Number(x.in), 0), to = m.days.reduce((a, x) => a + Number(x.out), 0), cl = Number(m.opening) + ti - to;
      return { m, by, ti, to, cl };
    });
    const cell = (x) => !x ? '<td class="num mut">·</td>' : `<td class="num" style="line-height:1.15">${Number(x.in) ? `<span style="color:#16a34a">+${n(x.in)}</span>` : ""}${Number(x.in) && Number(x.out) ? "<br>" : ""}${Number(x.out) ? `<span style="color:#dc2626">−${n(x.out)}</span>` : ""}</td>`;
    S.el.innerHTML = `<div class="row noprint"><h3 style="margin:0">${esc((d.unit || "").replace("‑", "-"))} · Raw material stock · ${esc(S.month)}</h3><span class="grow"></span><a class="btn o sm" href="/it/rmstock.html?co=${encodeURIComponent(QP.slug)}" target="_blank">Mobile entry screen</a></div>
    <p class="note">Quantities are typed on the mobile screen (or here). Green = received, red = issued. Click an Opening figure to type the opening stock straight in the table (Enter to save). Click a material name to see, edit or delete its entries. Closing = opening + received − issued; the current balance feeds the planning screens and the evening report.</p>
    <div class="rmp-sc"><table class="lt"><thead><tr><th style="position:sticky;left:0;z-index:4;background:#EEF2F8">Part</th><th>Material spec</th><th>Unit</th><th class="num">Opening</th>${days.map((x) => `<th class="num" style="min-width:58px">${x.slice(8)}</th>`).join("")}<th class="num">Received</th><th class="num">Issued</th><th class="num">Closing</th><th class="num">Current balance</th></tr></thead><tbody>
    ${rows.length ? rows.map((r) => `<tr data-mat="${esc(r.m.code)}" style="cursor:pointer;${S.sel === r.m.code ? "background:#e0f2fe;color:#000" : ""}"><td style="position:sticky;left:0;background:${S.sel === r.m.code ? "#e0f2fe" : "var(--card)"};font-weight:700">${esc(r.m.code)}</td><td>${esc(r.m.spec || "")}</td><td>${esc(r.m.unit)}</td><td class="num" ${can ? `data-op="${esc(r.m.code)}" data-v="${Number(r.m.opening)}" title="Click to edit the opening stock" style="cursor:text;text-decoration:underline dotted;color:#0e7490;font-weight:700"` : ""}>${n(r.m.opening)}</td>${days.map((x) => cell(r.by[x])).join("")}<td class="num" style="color:#16a34a">${n(r.ti)}</td><td class="num" style="color:#dc2626">${n(r.to)}</td><td class="num"><b>${n(r.cl)}</b></td><td class="num"><b>${n(r.m.current)}</b></td></tr>`).join("") : `<tr><td colspan="${days.length + 7}" class="mut">No materials yet. Add them in Materials &amp; BOM first.</td></tr>`}
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
  }

  document.addEventListener("click", async (ev) => {
    const t = ev.target; if (!$("#rmdet")) return;
    try {
      const op = t.closest("[data-op]");
      if (op && S.d.can_edit) {
        if (op.querySelector("input")) return;
        const was = Number(op.dataset.v); op.innerHTML = `<input type="text" inputmode="decimal" autocomplete="off" value="${was}" style="width:96px;text-align:right;font:inherit;padding:4px 6px">`;
        const inp = op.firstChild; inp.focus(); inp.select(); let done = false;
        const fin = async (save) => {
          if (done) return; done = true;
          const v = Number(String(inp.value).replace(/,/g, ""));
          if (save && inp.value !== "" && v !== was) { try { await call("kmr_rm_set_opening", { p_material: op.dataset.op, p_month: S.month, p_qty: v }); say("Opening stock saved.", true); } catch (e) { say(e.message); } }
          await draw(S.el, S.month);
        };
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") fin(true); else if (e.key === "Escape") fin(false); });
        inp.addEventListener("blur", () => fin(true));
        return;
      }
      const tr = t.closest("tr[data-mat]");
      if (tr && !t.closest("button")) { S.sel = tr.dataset.mat; S.edit = null; await paint(); return; }
      const re = t.closest("[data-re]"); if (re) { const all = await call("kmr_rm_txns", { p_from: "2000-01-01", p_to: ist(), p_material: S.sel }); S.edit = all.find((x) => x.id === re.dataset.re) || null; await detail(); $("#rmf") && $("#rmf").scrollIntoView({ block: "nearest" }); return; }
      const rd = t.closest("[data-rd]"); if (rd) { if (!await KMRDlg.yes("Delete this entry? The balance changes back.")) return; await call("kmr_rm_delete", { p_id: rd.dataset.rd }); S.edit = null; say("Deleted.", true); await draw(S.el, S.month); return; }
      const rs = t.closest("[data-rs]"); if (!rs) return;
      if (rs.dataset.rs === "cancel") { S.edit = null; await detail(); return; }
      const q = Number($("#rq").value); if (!(q > 0)) return say("Type the quantity.");
      await call("kmr_rm_save", { p: { id: S.edit ? S.edit.id : null, material_code: S.sel, kind: $("#rk").value, qty: q, txn_date: $("#rd").value, ref: $("#rr").value, remarks: $("#rm").value } });
      S.edit = null; say("Saved.", true); await draw(S.el, S.month);
    } catch (e) { say(e.message); }
  });
  window.RMStock = { draw };
})();
