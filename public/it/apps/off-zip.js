/* KMR Office Suite - shared helpers: zip reader/writer (for .docx .xlsx .pptx), xml helpers, file download/read.
   No outside libraries: the browser's own CompressionStream / DecompressionStream do the (de)flate. */
(function () {
  "use strict";
  const enc = new TextEncoder(), dec = new TextDecoder("utf-8");
  const bytes = (s) => (typeof s === "string" ? enc.encode(s) : s);
  const CT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u) => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function pipe(data, Stream, fmt) {
    const s = new Blob([data]).stream().pipeThrough(new Stream(fmt));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const canZ = typeof CompressionStream !== "undefined", canU = typeof DecompressionStream !== "undefined";
  const u16 = (v, o, n) => { v[o] = n & 255; v[o + 1] = (n >>> 8) & 255; }, u32 = (v, o, n) => { v[o] = n & 255; v[o + 1] = (n >>> 8) & 255; v[o + 2] = (n >>> 16) & 255; v[o + 3] = (n >>> 24) & 255; };
  /* build a zip from [{name, data}] (data = string or Uint8Array). Text parts are deflated; images stay stored. */
  async function build(entries) {
    const parts = [], cen = []; let off = 0; const now = new Date();
    const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
    for (const e of entries) {
      const nm = enc.encode(e.name), raw = bytes(e.data), crc = crc32(raw);
      let body = raw, method = 0;
      if (canZ && raw.length > 120 && !/\.(png|jpe?g|gif|webp)$/i.test(e.name)) { try { const z = await pipe(raw, CompressionStream, "deflate-raw"); if (z.length < raw.length) { body = z; method = 8; } } catch (x) { /* store */ } }
      const h = new Uint8Array(30 + nm.length); u32(h, 0, 0x04034b50); u16(h, 4, 20); u16(h, 6, 0x0800); u16(h, 8, method); u16(h, 10, dt); u16(h, 12, dd); u32(h, 14, crc); u32(h, 18, body.length); u32(h, 22, raw.length); u16(h, 26, nm.length); u16(h, 28, 0); h.set(nm, 30);
      parts.push(h, body);
      const c = new Uint8Array(46 + nm.length); u32(c, 0, 0x02014b50); u16(c, 4, 20); u16(c, 6, 20); u16(c, 8, 0x0800); u16(c, 10, method); u16(c, 12, dt); u16(c, 14, dd); u32(c, 16, crc); u32(c, 20, body.length); u32(c, 24, raw.length); u16(c, 28, nm.length); u32(c, 42, off); c.set(nm, 46);
      cen.push(c); off += h.length + body.length;
    }
    const csz = cen.reduce((s, c) => s + c.length, 0), end = new Uint8Array(22); u32(end, 0, 0x06054b50); u16(end, 8, entries.length); u16(end, 10, entries.length); u32(end, 12, csz); u32(end, 16, off);
    return new Blob([...parts, ...cen, end]);
  }
  /* read a zip: returns { names:[...], bytes(name) -> Promise<Uint8Array>, text(name) -> Promise<string>|null, has(name) } */
  async function read(buf) {
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let e = -1; for (let i = u.length - 22; i >= Math.max(0, u.length - 66000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; } }
    if (e < 0) throw new Error("This file is not a valid Office file (it could not be opened as a package).");
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const idx = {};
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = dec.decode(u.subarray(p + 46, p + 46 + nl)); idx[name] = { method, csz, lo }; p += 46 + nl + el + cl;
    }
    const get = async (name) => {
      const f = idx[name]; if (!f) return null;
      const lnl = dv.getUint16(f.lo + 26, true), lel = dv.getUint16(f.lo + 28, true), st = f.lo + 30 + lnl + lel, body = u.subarray(st, st + f.csz);
      if (f.method === 0) return body;
      if (f.method === 8) { if (!canU) throw new Error("This browser cannot open compressed Office files. Please use a current Chrome, Edge, Firefox or Safari."); return pipe(body, DecompressionStream, "deflate-raw"); }
      throw new Error("Unsupported compression in the file.");
    };
    return { names: Object.keys(idx), has: (n2) => !!idx[n2], bytes: get, text: async (n2) => { const b = await get(n2); return b ? dec.decode(b) : null; } };
  }
  /* xml helpers */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const parse = (s) => { const d = new DOMParser().parseFromString(s, "application/xml"); if (d.getElementsByTagName("parsererror").length) throw new Error("A part of the file could not be read (bad XML)."); return d; };
  const kids = (el, name) => { const o = []; if (!el) return o; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) o.push(c); return o; };
  const kid = (el, name) => { if (!el) return null; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c; return null; };
  const at = (el, name) => (el ? el.getAttribute(name) : null);
  const deep = (el, name) => (el ? Array.from(el.getElementsByTagName("*")).filter((x) => x.localName === name) : []);
  /* data urls */
  const dataToBytes = (u) => { const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(u || ""); if (!m) return null; const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return { mime: m[1] || "application/octet-stream", bytes: o }; };
  const bytesToData = (b, mime) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(new Blob([b], { type: mime })); });
  const mimeOf = (name) => { const e = (/\.([a-z0-9]+)$/i.exec(name) || [])[1]; return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp", bmp: "image/bmp", emf: "image/x-emf", wmf: "image/x-wmf" }[(e || "").toLowerCase()] || "application/octet-stream"; };
  const extOf = (mime) => ({ "image/png": "png", "image/jpeg": "jpeg", "image/gif": "gif", "image/svg+xml": "svg", "image/webp": "webp", "image/bmp": "bmp" }[mime] || "png");
  function imgSize(u) { return new Promise((ok) => { const im = new Image(); im.onload = () => ok([im.naturalWidth || 100, im.naturalHeight || 100]); im.onerror = () => ok([100, 100]); im.src = u; }); }
  /* images in other formats (svg, webp, bmp, gif) are turned into png for Office files */
  async function toPng(u) {
    const d = dataToBytes(u); if (d && /^image\/(png|jpeg)$/.test(d.mime)) return d;
    const [w, h] = await imgSize(u), c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), im = new Image();
    await new Promise((ok) => { im.onload = ok; im.onerror = ok; im.src = u; }); try { g.drawImage(im, 0, 0, w, h); } catch (e) { /* ignore */ }
    return dataToBytes(c.toDataURL("image/png"));
  }
  function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const readBuf = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error("The file could not be read.")); r.readAsArrayBuffer(f); });
  const readText = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error("The file could not be read.")); r.readAsText(f); });
  const readData = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error("The file could not be read.")); r.readAsDataURL(f); });
  const safeName = (s) => String(s || "file").replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80) || "file";
  window.OffZip = { build, read, crc32, esc, parse, kids, kid, at, deep, dataToBytes, bytesToData, mimeOf, extOf, imgSize, toPng, download, readBuf, readText, readData, safeName, bytes, dec };
})();
