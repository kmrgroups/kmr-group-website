/* KMR Apps sign-in scene — "Agentic AI · Intelligent Digital Manufacturing Systems".
   An AI core; every module and standard orbits it as a glowing icon tile on three rings
   (operations, quality tools, standards), with data streams flowing between the core and each tile.
   three.js r128 (same as Balloon Inspector); falls back to the CSS aurora when WebGL is unavailable. */
(function () {
  "use strict";
  const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  const RINGS = [
    { r: 3.0, tilt: 0.18, speed: 0.10, color: "#22D3EE", items: [
      ["HRM", "people"], ["Production Planning", "gantt"], ["Procurement", "cart"], ["MMD", "flow"],
      ["Warehouse", "box"], ["Maintenance", "wrench"], ["CRM", "hand"], ["RFQ", "quote"]] },
    { r: 4.25, tilt: -0.14, speed: -0.07, color: "#C084FC", items: [
      ["Ballooning", "balloon"], ["PPAP Docs", "doc"], ["APQP", "steps"], ["PPAP", "check"], ["AIAG-VDA FMEA", "warn"],
      ["Control Plan", "clip"], ["MSA", "gauge"], ["SPC", "chart"], ["8D", "eight"], ["QMS", "shield"]] },
    { r: 5.35, tilt: 0.1, speed: 0.045, color: "#FBBF24", items: [
      ["IATF 16949", "badge"], ["ISO 9001", "badge"], ["ISO 45001", "badge"], ["VDA 6.3", "badge"]] },
  ];

  function icon(x, kind, cx, cy, s, col) {
    x.save(); x.translate(cx, cy); x.scale(s / 24, s / 24); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2; x.lineCap = "round"; x.lineJoin = "round";
    const P = (d) => x.stroke(new Path2D(d));
    ({
      people: () => { P("M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.5a3 3 0 0 1 0 6M17.5 14.6c2.3.5 3.7 2.4 4 5.4"); },
      gantt: () => { P("M3 4v16h18M7 8h7M9 12h8M6 16h6"); },
      cart: () => { P("M3 4h2l2.5 11h11L21 7H6.2M9 20h.01M17 20h.01"); },
      flow: () => { P("M4 6h6v5H4zM14 13h6v5h-6zM10 8.5h4v7"); },
      box: () => { P("M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9"); },
      wrench: () => { P("M14.5 6.5a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2z"); },
      hand: () => { P("M3 12l4-4 5 3 5-3 4 4-6 6-3-2-3 2z"); },
      quote: () => { P("M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5"); },
      balloon: () => { P("M11 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14.5 11.5 20 20"); x.font = "bold 7px Arial"; x.textAlign = "center"; x.fillText("1", 11, 10.5); },
      doc: () => { P("M6 3h9l4 4v14H6zM9 11h7M9 14h7M9 17h4"); },
      steps: () => { P("M3 20h5v-4h5v-4h5V8h3"); },
      check: () => { P("M4 12.5 9.5 18 20 6"); },
      warn: () => { P("M12 3 2.5 20h19zM12 10v4M12 17h.01"); },
      clip: () => { P("M8 4h8v3H8zM6 5.5H5v15h14v-15h-1M9 12h6M9 16h6"); },
      gauge: () => { P("M4 16a8 8 0 1 1 16 0M12 16l4-5"); },
      chart: () => { P("M3 18l5-6 4 3 5-8 4 4M3 21h18"); },
      eight: () => { P("M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 20a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5z"); },
      shield: () => { P("M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM8.5 12l2.5 2.5 4.5-5"); },
      badge: () => { P("M12 3l2.6 2 3.3-.2.9 3.2 2.7 1.9-1.2 3.1 1.2 3.1-2.7 1.9-.9 3.2-3.3-.2L12 23l-2.6-2-3.3.2-.9-3.2-2.7-1.9 1.2-3.1-1.2-3.1 2.7-1.9.9-3.2 3.3.2z"); P("M8.5 12.5l2.5 2.5 4.5-5"); },
    }[kind] || (() => {}))();
    x.restore();
  }
  function tile(T, label, kind, color, standard) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 176; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 512, 176); g.addColorStop(0, "rgba(20,14,54,.88)"); g.addColorStop(1, "rgba(8,6,28,.88)");
    x.fillStyle = g; x.beginPath(); x.roundRect(8, 8, 496, 160, standard ? 80 : 34); x.fill();
    x.strokeStyle = color; x.lineWidth = 5; x.shadowColor = color; x.shadowBlur = 24; x.stroke(); x.shadowBlur = 0;
    x.fillStyle = color + "33"; x.beginPath(); x.arc(92, 88, 54, 0, 6.28); x.fill();
    icon(x, kind, 92, 88, 64, color);
    x.fillStyle = "#fff"; x.font = `700 ${label.length > 12 ? 40 : 48}px Segoe UI, Arial`; x.textBaseline = "middle"; x.fillText(label, 168, 90);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(1.55, 0.53, 1); return s;
  }

  function build(host) {
    const T = window.THREE, cv = host.querySelector("canvas"), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.25; R.setClearColor(0, 0);
    const S = new T.Scene(), cam = new T.PerspectiveCamera(34, 1, 0.1, 100); S.fog = new T.FogExp2(0x0a0720, 0.035);
    const ADD = T.AdditiveBlending;
    const radial = (stops, n) => { const c = document.createElement("canvas"); c.width = c.height = n || 128; const x = c.getContext("2d"), h = c.width / 2, g = x.createRadialGradient(h, h, 0, h, h, h); stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height); return new T.CanvasTexture(c); };
    const dot = radial([[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,255,255,.7)"], [1, "rgba(255,255,255,0)"]], 64);

    // floor
    const grid = new T.GridHelper(40, 60, 0xa855f7, 0x2e2170); grid.material.transparent = true; grid.material.opacity = 0.28; grid.position.y = -2.6; S.add(grid);
    const pulses = [0, 1, 2].map((i) => { const m = new T.Mesh(new T.RingGeometry(1, 1.03, 128), new T.MeshBasicMaterial({ color: [0x22d3ee, 0xa855f7, 0xfbbf24][i], transparent: true, opacity: 0, blending: ADD, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = -2.58; S.add(m); return m; });

    // AI core: glowing heart, neural icosahedron, orbiting shell
    const core = new T.Group(); S.add(core);
    const heart = new T.Sprite(new T.SpriteMaterial({ map: radial([[0, "rgba(255,255,255,1)"], [0.18, "rgba(165,243,252,.95)"], [0.45, "rgba(168,85,247,.55)"], [1, "rgba(0,0,0,0)"]], 256), blending: ADD, transparent: true, depthWrite: false }));
    heart.scale.set(3.4, 3.4, 1); core.add(heart);
    const ico = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(1.15, 1)), new T.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.8, blending: ADD })); core.add(ico);
    const ico2 = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(1.55, 0)), new T.LineBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.45, blending: ADD })); core.add(ico2);
    const nodes = new T.Points(new T.IcosahedronGeometry(1.15, 1), new T.PointsMaterial({ size: 0.12, map: dot, color: 0xffffff, transparent: true, blending: ADD, depthWrite: false })); core.add(nodes);

    // rings of module tiles
    const tiles = [], rings = [];
    RINGS.forEach((ring, ri) => {
      const g = new T.Group(); g.rotation.x = ring.tilt; S.add(g); rings.push({ g, ring });
      const circle = new T.Mesh(new T.TorusGeometry(ring.r, 0.008, 6, 256), new T.MeshBasicMaterial({ color: new T.Color(ring.color), transparent: true, opacity: 0.35, blending: ADD })); circle.rotation.x = Math.PI / 2; g.add(circle);
      ring.items.forEach(([label, kind], i) => {
        const s = tile(T, label, kind, ring.color, ri === 2); const a = (i / ring.items.length) * Math.PI * 2;
        s.userData = { a, ri, r: ring.r }; s.position.set(Math.cos(a) * ring.r, Math.sin(i * 1.7) * 0.25, Math.sin(a) * ring.r); g.add(s); tiles.push(s);
      });
    });

    // agentic data streams: particles travelling core → tile → core
    const NS = still ? 1 : 900, sp = new Float32Array(NS * 3), sc = new Float32Array(NS * 3), st = [];
    const cols = ["#22D3EE", "#C084FC", "#FBBF24"].map((h) => new T.Color(h));
    for (let i = 0; i < NS; i++) { const k = i % tiles.length; st.push({ k, f: Math.random(), v: 0.18 + Math.random() * 0.25, back: Math.random() < 0.4 }); const c = cols[tiles[k].userData.ri]; sc.set([c.r, c.g, c.b], i * 3); }
    const sg = new T.BufferGeometry(); sg.setAttribute("position", new T.BufferAttribute(sp, 3)); sg.setAttribute("color", new T.BufferAttribute(sc, 3));
    S.add(new T.Points(sg, new T.PointsMaterial({ size: 0.07, map: dot, vertexColors: true, transparent: true, opacity: 0.9, blending: ADD, depthWrite: false })));
    // dust
    const ND = 500, dp = new Float32Array(ND * 3); for (let i = 0; i < ND; i++) dp.set([(Math.random() - 0.5) * 30, (Math.random() - 0.3) * 12, (Math.random() - 0.5) * 30], i * 3);
    const dg = new T.BufferGeometry(); dg.setAttribute("position", new T.BufferAttribute(dp, 3));
    S.add(new T.Points(dg, new T.PointsMaterial({ size: 0.05, map: dot, color: 0x9aa8ff, transparent: true, opacity: 0.55, blending: ADD, depthWrite: false })));

    let W = 1, H = 1, mx = 0, my = 0; const t0 = performance.now(), v = new T.Vector3();
    const resize = () => { W = host.clientWidth || 1; H = host.clientHeight || 1; R.setSize(W, H, false); cam.aspect = W / H; cam.fov = W / H < 0.9 ? 52 : 34; cam.updateProjectionMatrix(); };
    addEventListener("resize", resize); resize();
    host.addEventListener("pointermove", (e) => { const b = host.getBoundingClientRect(); mx = (e.clientX - b.left) / b.width - 0.5; my = (e.clientY - b.top) / b.height - 0.5; });
    const frame = (now) => {
      const t = still ? 5 : (now - t0) / 1000;
      const ca = t * 0.05 + mx * 0.6; cam.position.set(Math.sin(ca) * 13.5, 3.6 - my * 2, Math.cos(ca) * 13.5); cam.lookAt(0, 0.2, 0);
      core.rotation.y = t * 0.35; ico.rotation.x = t * 0.2; ico2.rotation.z = -t * 0.15; heart.scale.setScalar(3.3 + Math.sin(t * 2.2) * 0.25);
      rings.forEach(({ g, ring }) => { g.rotation.y = t * ring.speed; });
      pulses.forEach((m, i) => { const f = (t * 0.25 + i / 3) % 1; m.scale.setScalar(1 + f * 9); m.material.opacity = (1 - f) * 0.45; });
      for (let i = 0; i < NS; i++) {
        const s = st[i]; s.f += s.v * 0.016; if (s.f > 1) { s.f = 0; s.k = Math.floor(Math.random() * tiles.length); s.back = Math.random() < 0.4; const c = cols[tiles[s.k].userData.ri]; sc.set([c.r, c.g, c.b], i * 3); }
        tiles[s.k].getWorldPosition(v); const f = s.back ? 1 - s.f : s.f, arc = Math.sin(f * Math.PI) * 0.6;
        sp[i * 3] = v.x * f; sp[i * 3 + 1] = v.y * f + arc; sp[i * 3 + 2] = v.z * f;
      }
      sg.attributes.position.needsUpdate = true; sg.attributes.color.needsUpdate = true;
      R.render(S, cam); if (!still) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame); host.classList.add("ready");
  }
  window.KMR_SCENE = function (host) {
    try { const c = document.createElement("canvas"); if (!(c.getContext("webgl2") || c.getContext("webgl"))) return; } catch (e) { return; }
    const go = () => { try { build(host); } catch (e) { console.warn("3D scene:", e); } };
    if (window.THREE) return go();
    const s = document.createElement("script"); s.src = THREE_URL; s.onload = go; document.head.append(s);
  };
})();
