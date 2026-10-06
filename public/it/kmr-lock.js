/* KMR feature lock — a customer only gets the features on their quote / paid invoice.
   KMRLock.init(sb, slug, product, {tab:'feature.key'}, {'feature.key':'Name'}) → marks locked tabs with a lock and blocks them.
   No list set for the company (restricted = false) or any error → every feature stays open. */
(function () {
  var S = { feat: null, map: {}, names: {}, home: null };
  function locked(tab) { var k = S.map[tab]; return !!(k && S.feat && !S.feat.has(k)); }
  function dialog(tab) { return show(S.map[tab]); }
  function show(k) {
    var n = (S.names[k] || 'This feature');
    var o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    o.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fff;color:#0f172a;max-width:420px;width:100%;border-radius:12px;padding:20px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.3)"><h3 style="margin:0 0 8px;font-size:17px">Not in your plan</h3><p style="margin:0 0 8px"><b></b> is not part of your company\'s subscription.</p><p style="margin:0 0 14px">To add it, please contact KMR Group of Companies — <a href="https://www.kmr-groups.com/contact" target="_blank" rel="noopener">www.kmr-groups.com/contact</a>.</p><button style="background:#0f2d5c;color:#fff;border:0;border-radius:8px;padding:8px 18px;font:inherit;cursor:pointer">OK</button></div>';
    o.querySelector('b').textContent = n;
    var close = function () { o.remove(); };
    o.querySelector('button').onclick = close; o.onclick = function (e) { if (e.target === o) close(); };
    document.body.appendChild(o); o.querySelector('button').focus();
  }
  function mark() {
    document.querySelectorAll('.tab[data-t]').forEach(function (t) {
      if (locked(t.dataset.t) && !t.dataset.lk) { t.dataset.lk = '1'; t.title = 'Not in your plan'; t.insertAdjacentHTML('afterbegin', '<span aria-label="Locked">🔒</span> '); }
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.tab[data-t]'); if (!t || !locked(t.dataset.t)) return;
    e.preventDefault(); e.stopImmediatePropagation(); dialog(t.dataset.t);
  }, true);
  window.KMRLock = {
    locked: locked, dialog: dialog,
    /* a part of a screen: true if the feature is bought, otherwise shows the dialog and returns false */
    need: function (k) { if (!S.feat || S.feat.has(k)) return true; show(k); return false; }, mark: mark, has: function (k) { return !S.feat || S.feat.has(k); },
    init: async function (sb, slug, product, map, names) {
      S.map = map || {}; S.names = names || {};
      try {
        var r = await sb.rpc('kmr_portal_features', { p_slug: slug });
        var row = (r && r.data || []).find(function (x) { return x.product_code === product; });
        S.feat = row && row.restricted ? new Set((row.features || []).map(function (f) { return f.key; })) : null;
      } catch (e) { S.feat = null; }
      mark(); return S.feat;
    }
  };
})();
