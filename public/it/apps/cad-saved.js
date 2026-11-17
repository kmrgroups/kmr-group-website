/* KMR CAD Draft — open a customer drawing saved in Operations Master → Parts (same file PPAP, Process Documents, Balloon Inspector and 8D use).
   Adds a choice to every CAD file picker: "From this device" or "Saved customer drawing". The chosen PDF / picture then goes through the normal convert-to-CAD flow. */
(function (K) {
  const base = K.pickFile; if (!base) return;
  K.pickFile = (accept) => {
    const Q = window.QP;
    if (!window.KMRDrawings || !Q || Q.DEMO || !Q.sb || !Q.slug || !/pdf|png|jpe?g/i.test(accept || "")) return base(accept);
    return new Promise((res) => {
      const v = document.createElement("div"); v.style.cssText = "position:fixed;inset:0;background:#0009;z-index:99998;display:flex;align-items:center;justify-content:center;padding:12px";
      v.innerHTML = '<div style="background:#fff;color:#0f172a;border-radius:14px;padding:18px;width:min(380px,100%);font:14px/1.4 system-ui,sans-serif"><h3 style="margin:0 0 10px">Open a drawing</h3><button data-dev style="display:block;width:100%;margin-bottom:8px;border:0;border-radius:9px;padding:11px;font-weight:700;background:#1E4FB8;color:#fff;cursor:pointer">From this device</button><button data-sav style="display:block;width:100%;margin-bottom:8px;border:0;border-radius:9px;padding:11px;font-weight:700;background:#0F766E;color:#fff;cursor:pointer">📐 Saved customer drawing</button><button data-x style="display:block;width:100%;border:1px solid #CBD5E1;border-radius:9px;padding:9px;font-weight:600;background:#fff;cursor:pointer">Cancel</button></div>';
      document.body.appendChild(v);
      v.querySelector("[data-dev]").onclick = () => { v.remove(); base(accept).then(res); };
      v.querySelector("[data-x]").onclick = () => { v.remove(); res(null); };
      v.querySelector("[data-sav]").onclick = () => { v.remove(); KMRDrawings.pick({ sb: Q.sb, slug: Q.slug, onCancel: () => res(null) }, (f) => res(f)); };
    });
  };
})(window.KCAD);
