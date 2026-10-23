/* Developer sample-data button — appears in the footer of every KMR app, ONLY for the KMR developer login (KMR staff).
   "Sample data" opens a small box: Load the sample data of this app into the company's workspace, or Remove exactly that sample data.
   Nothing is shown to customers or their users. The database refuses anyone who is not KMR staff (kmr_is_staff / kmr_app_sample, migration 0078). */
(function () {
  "use strict";
  if (window.__kmrDev) return; window.__kmrDev = 1;
  if (/[?&]demo=1(&|$)/.test(location.search)) return;                       // the sample-data demo needs no button
  const P = location.pathname;
  const APP = /balloon/.test(P) ? "balloon" : /pd\.html/.test(P) ? "pd" : /capacity/.test(P) ? "capacity" : /sales\.html/.test(P) ? "sales" : /calibration/.test(P) ? "calib" : /apqp\.html/.test(P) ? "apqp" : /ppap\.html/.test(P) ? "ppap" : /rmp\.html/.test(P) ? "rmp" : /mmd\.html/.test(P) ? "mmd" : /mnt\.html/.test(P) ? "mnt" : /mom\.html/.test(P) ? "mom" : /cad\.html/.test(P) ? "cad" : /hrm\.html/.test(P) ? "hrms" : /tasks\.html/.test(P) ? "tsk" : /msa\.html/.test(P) ? "msa" : /spc\.html/.test(P) ? "spc" : /crm\.html/.test(P) ? "crm" : /d8\.html/.test(P) ? "d8" : /qms\.html/.test(P) ? "qms" : /aud\.html/.test(P) ? "aud" : /office\.html/.test(P) ? "off" : "";
  if (!APP) return;
  const NAME = { balloon: "Balloon Inspector", pd: "Process Documents", capacity: "Capacity Planner", sales: "Sales Flow", calib: "Calibration Hub", apqp: "APQP", ppap: "PPAP", rmp: "Raw Material & Packing", mmd: "Machines, Moulds & Dies", mnt: "Maintenance", mom: "MoM", cad: "CAD", hrms: "HRM", tsk: "ActionTrack", msa: "MSA Studies", spc: "SPC Charts", crm: "CRM & RFQ", d8: "8D Problem Solving", qms: "QMS Learning Guide", aud: "Internal Audit", off: "KMR Office Suite" }[APP];
  const SHARED = { pd: "the Operations Master (parts, machines, gauges… shared with Capacity Planner and Sales Flow)", capacity: "the Operations Master (parts, machines, gauges… shared with Process Documents and Sales Flow)" }[APP] || "";
  const hasSession = () => { try { for (let i = 0; i < localStorage.length; i++) if (/^sb-.+-auth-token$/.test(localStorage.key(i))) return true; } catch (e) { /* ignore */ } return false; };
  const slug = () => { let p = null; try { p = JSON.parse(localStorage.getItem("kmr-portal") || "null"); } catch (e) { /* ignore */ } return new URLSearchParams(location.search).get("co") || (p && p.slug) || ""; };
  let sb = null;
  async function client() {
    if (sb) return sb; const C = window.COMPANY_CONFIG || {};
    if (window.KMR_SB) return (sb = window.KMR_SB);
    let url = C.supabaseUrl, key = C.supabaseAnonKey;
    if (!url || !key) { try { const r = await fetch("/it/console/api/public-config"); if (r.ok) { const j = await r.json(); url = j.url || url; key = j.key || key; } } catch (e) { /* ignore */ } }
    if (!url || !key) throw new Error("The platform key is not configured.");
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm"); return (sb = createClient(url, key));
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  async function act(action, box) {
    const msg = box.querySelector("#kdMsg"), btns = box.querySelectorAll("button"); btns.forEach((b) => (b.disabled = true)); msg.style.color = "#5E6B7E"; msg.textContent = action === "load" ? "Loading sample data…" : "Removing sample data…";
    try {
      const { data, error } = await (await client()).rpc("kmr_app_sample", { p_slug: slug(), p_app: APP, p_action: action }); if (error) throw new Error(error.message);
      const n = Object.values(data || {}).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);
      msg.style.color = "#047857"; msg.textContent = (action === "load" ? "Sample data loaded" : "Sample data removed") + (n ? " (" + n + " records)" : "") + ". Reloading…"; setTimeout(() => location.reload(), 900);
    } catch (e) { msg.style.color = "#b91c1c"; msg.textContent = e.message; btns.forEach((b) => (b.disabled = false)); }
  }
  function open() {
    const v = document.createElement("div"); v.className = "kmr-veil";
    v.innerHTML = `<div class="kmr-dlg" role="dialog" aria-label="Sample data"><h3>🧪 Sample data — ${esc(NAME)}</h3>
      <p>Developer tool. Puts ready-made sample records into <b>${esc(slug())}</b>’s ${esc(NAME)}, so you can show or test the app. Everything loaded is marked as sample and “Remove” takes out only that.${SHARED ? "<br><br><b>Note:</b> this app uses " + esc(SHARED) + ". Removing it clears the sample records in all of them." : ""}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="go" href="#" id="kdLoad">Load sample data</a><button type="button" id="kdFlush">Remove sample data</button><button type="button" id="kdClose">Close</button></div>
      <p id="kdMsg" style="margin:12px 0 0;font-size:13px"></p></div>`;
    document.body.append(v); const box = v.firstElementChild;
    v.onclick = (e) => { if (e.target === v) v.remove(); }; box.querySelector("#kdClose").onclick = () => v.remove();
    box.querySelector("#kdLoad").onclick = (e) => { e.preventDefault(); act("load", box); };
    box.querySelector("#kdFlush").onclick = () => { if (confirm("Remove the sample data of " + NAME + " from " + slug() + "? Real records are not touched.")) act("flush", box); };
  }
  function addButton() {
    if (document.getElementById("kmrDevSample")) return;
    const role = document.getElementById("role"), slot = document.getElementById("kmrPlant") || document.querySelector(".kmr-foot .kmr-slot:last-child"); if (!role && !slot) return;
    const b = document.createElement("button"); b.type = "button"; b.id = "kmrDevSample"; b.className = "noprint"; b.title = "Developer only: load or remove sample data for this app";
    b.style.cssText = "font:700 12.5px 'Segoe UI',Arial;border:1px solid #fbbf24;color:#1a1305;background:linear-gradient(180deg,#ffe08a,#f3c55a);border-radius:999px;padding:4px 12px;cursor:pointer;margin-left:8px;white-space:nowrap"; b.textContent = "🧪 Sample data (developer)"; b.onclick = open;
    if (role) role.insertAdjacentElement("beforebegin", b); else slot.append(b);   // next to the signed-in e-mail at the top; footer when the app has no top chip
  }
  async function init() {
    if (!hasSession() || !slug()) return;
    try { const { data } = await (await client()).rpc("kmr_is_staff"); if (data === true) { addButton(); new MutationObserver(addButton).observe(document.body, { childList: true }); } } catch (e) { /* not staff or not reachable: no button */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 600)); else setTimeout(init, 600);
})();
