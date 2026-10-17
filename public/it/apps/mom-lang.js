/* Minutes Of Meetings - languages, script detection, translation and the voice recogniser.
   Voice: the browser's own speech service (Chrome / Edge / Safari). It needs the spoken language to be chosen:
   the app can switch between up to three meeting languages by itself when the speech does not match.
   Translation: the browser's built-in Translator when present, otherwise the public MyMemory service. */
(function () {
  "use strict";
  /* [speech tag, translate code, English name, native name, voice supported, right-to-left] */
  const L = [
    ["en-IN", "en", "English (India)", "English", 1], ["hi-IN", "hi", "Hindi", "हिन्दी", 1], ["ta-IN", "ta", "Tamil", "தமிழ்", 1], ["te-IN", "te", "Telugu", "తెలుగు", 1],
    ["kn-IN", "kn", "Kannada", "ಕನ್ನಡ", 1], ["ml-IN", "ml", "Malayalam", "മലയാളം", 1], ["mr-IN", "mr", "Marathi", "मराठी", 1], ["gu-IN", "gu", "Gujarati", "ગુજરાતી", 1],
    ["bn-IN", "bn", "Bengali (India)", "বাংলা", 1], ["pa-Guru-IN", "pa", "Punjabi", "ਪੰਜਾਬੀ", 1], ["ur-IN", "ur", "Urdu (India)", "اردو", 1, 1], ["or-IN", "or", "Odia", "ଓଡ଼ିଆ", 0],
    ["as-IN", "as", "Assamese", "অসমীয়া", 0], ["ne-NP", "ne", "Nepali", "नेपाली", 1], ["si-LK", "si", "Sinhala", "සිංහල", 1], ["sa-IN", "sa", "Sanskrit", "संस्कृतम्", 0],
    ["en-US", "en", "English (US)", "English", 1], ["en-GB", "en", "English (UK)", "English", 1], ["en-AU", "en", "English (Australia)", "English", 1], ["en-SG", "en", "English (Singapore)", "English", 1],
    ["es-ES", "es", "Spanish (Spain)", "Español", 1], ["es-MX", "es", "Spanish (Mexico)", "Español", 1], ["fr-FR", "fr", "French", "Français", 1], ["de-DE", "de", "German", "Deutsch", 1],
    ["it-IT", "it", "Italian", "Italiano", 1], ["pt-BR", "pt", "Portuguese (Brazil)", "Português", 1], ["pt-PT", "pt", "Portuguese (Portugal)", "Português", 1], ["nl-NL", "nl", "Dutch", "Nederlands", 1],
    ["ru-RU", "ru", "Russian", "Русский", 1], ["uk-UA", "uk", "Ukrainian", "Українська", 1], ["pl-PL", "pl", "Polish", "Polski", 1], ["cs-CZ", "cs", "Czech", "Čeština", 1],
    ["sk-SK", "sk", "Slovak", "Slovenčina", 1], ["hu-HU", "hu", "Hungarian", "Magyar", 1], ["ro-RO", "ro", "Romanian", "Română", 1], ["bg-BG", "bg", "Bulgarian", "Български", 1],
    ["el-GR", "el", "Greek", "Ελληνικά", 1], ["sv-SE", "sv", "Swedish", "Svenska", 1], ["nb-NO", "no", "Norwegian", "Norsk", 1], ["da-DK", "da", "Danish", "Dansk", 1],
    ["fi-FI", "fi", "Finnish", "Suomi", 1], ["tr-TR", "tr", "Turkish", "Türkçe", 1], ["ar-SA", "ar", "Arabic (Saudi Arabia)", "العربية", 1, 1], ["ar-AE", "ar", "Arabic (UAE)", "العربية", 1, 1],
    ["he-IL", "he", "Hebrew", "עברית", 1, 1], ["fa-IR", "fa", "Persian", "فارسی", 1, 1], ["ur-PK", "ur", "Urdu (Pakistan)", "اردو", 1, 1], ["zh-CN", "zh-CN", "Chinese (Mandarin, Simplified)", "中文", 1],
    ["zh-TW", "zh-TW", "Chinese (Mandarin, Traditional)", "中文", 1], ["yue-Hant-HK", "zh-TW", "Cantonese", "粵語", 1], ["ja-JP", "ja", "Japanese", "日本語", 1], ["ko-KR", "ko", "Korean", "한국어", 1],
    ["th-TH", "th", "Thai", "ไทย", 1], ["vi-VN", "vi", "Vietnamese", "Tiếng Việt", 1], ["id-ID", "id", "Indonesian", "Bahasa Indonesia", 1], ["ms-MY", "ms", "Malay", "Bahasa Melayu", 1],
    ["fil-PH", "tl", "Filipino", "Filipino", 1], ["bn-BD", "bn", "Bengali (Bangladesh)", "বাংলা", 1], ["ta-LK", "ta", "Tamil (Sri Lanka)", "தமிழ்", 1], ["sw-KE", "sw", "Swahili", "Kiswahili", 1],
    ["af-ZA", "af", "Afrikaans", "Afrikaans", 1], ["am-ET", "am", "Amharic", "አማርኛ", 1], ["km-KH", "km", "Khmer", "ខ្មែរ", 1], ["lo-LA", "lo", "Lao", "ລາວ", 1], ["ka-GE", "ka", "Georgian", "ქართული", 1],
    ["hr-HR", "hr", "Croatian", "Hrvatski", 1], ["sr-RS", "sr", "Serbian", "Српски", 1], ["sl-SI", "sl", "Slovenian", "Slovenščina", 1], ["lt-LT", "lt", "Lithuanian", "Lietuvių", 1],
    ["lv-LV", "lv", "Latvian", "Latviešu", 1], ["et-EE", "et", "Estonian", "Eesti", 1], ["is-IS", "is", "Icelandic", "Íslenska", 1], ["uz-UZ", "uz", "Uzbek", "Oʻzbek", 1], ["zu-ZA", "zu", "Zulu", "isiZulu", 1]
  ].map((r) => ({ tag: r[0], tr: r[1], name: r[2], native: r[3], voice: !!r[4], rtl: !!r[5] }));
  const byTag = (t) => L.find((x) => x.tag === t) || L.find((x) => x.tag.split("-")[0] === String(t).split("-")[0]) || null;
  const label = (x) => x.name + (x.native && x.native !== x.name.split(" (")[0] ? " · " + x.native : "");

  /* which language is this text? Scripts that belong to one language are certain; Latin text is taken as English */
  const RANGES = [[/[஀-௿]/, "ta-IN", 1], [/[ఀ-౿]/, "te-IN", 1], [/[ಀ-೿]/, "kn-IN", 1], [/[ഀ-ൿ]/, "ml-IN", 1], [/[઀-૿]/, "gu-IN", 1],
    [/[਀-੿]/, "pa-Guru-IN", 1], [/[଀-୿]/, "or-IN", 1], [/[ঀ-৿]/, "bn-IN", 0], [/[ऀ-ॿ]/, "hi-IN", 0], [/[฀-๿]/, "th-TH", 1], [/[가-힯]/, "ko-KR", 1],
    [/[぀-ヿ]/, "ja-JP", 1], [/[一-鿿]/, "zh-CN", 0], [/[֐-׿]/, "he-IL", 1], [/[؀-ۿ]/, "ar-SA", 0], [/[Ͱ-Ͽ]/, "el-GR", 1], [/[Ѐ-ӿ]/, "ru-RU", 0],
    [/[඀-෿]/, "si-LK", 1], [/[ក-៿]/, "km-KH", 1], [/[Ⴀ-ჿ]/, "ka-GE", 1]];
  function detect(text) {
    const s = String(text || ""); for (const r of RANGES) if (r[0].test(s)) return { tag: r[1], certain: !!r[2] };
    return /[A-Za-z]/.test(s) ? { tag: "en-IN", certain: false } : { tag: "", certain: false };
  }

  /* ---------- translation ---------- */
  async function viaBrowser(text, from, to) {
    const T = window.Translator; if (!T || !T.create) return null;
    try {
      const av = await T.availability({ sourceLanguage: from, targetLanguage: to }); if (av === "unavailable") return null;
      const t = await T.create({ sourceLanguage: from, targetLanguage: to }); return await t.translate(text);
    } catch (e) { return null; }
  }
  function chunks(text, n) {
    const out = []; let cur = "";
    String(text).split(/(?<=[.!?।。])\s+|\n+/).forEach((p) => { if ((cur + " " + p).length > n && cur) { out.push(cur); cur = p; } else cur = cur ? cur + " " + p : p; });
    if (cur) out.push(cur);
    return out.flatMap((c) => (c.length > n ? c.match(new RegExp(".{1," + n + "}", "g")) : [c]));
  }
  async function viaMyMemory(text, from, to) {
    const parts = chunks(text, 450), out = [];
    for (const p of parts) {
      const r = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(p) + "&langpair=" + encodeURIComponent((from || "Autodetect") + "|" + to));
      if (!r.ok) throw new Error("The translation service did not answer (" + r.status + ").");
      const j = await r.json();
      if (j.responseStatus && +j.responseStatus !== 200) throw new Error(j.responseDetails || "The translation service refused the request (daily free limit?).");
      out.push((j.responseData && j.responseData.translatedText) || p);
    }
    return out.join(" ");
  }
  /** translate one piece of text; from = speech tag of the text (or "" to let the service detect it), to = speech tag */
  async function translate(text, from, to) {
    text = String(text || "").trim(); if (!text) return "";
    const f = from ? (byTag(from) || {}).tr : "", t = (byTag(to) || {}).tr; if (!t) throw new Error("Unknown target language.");
    if (f && f === t) return text;
    const b = f ? await viaBrowser(text, f, t) : null; if (b) return b;
    try { return await viaMyMemory(text, f, t); } catch (e) { if (e instanceof TypeError) throw new Error("Could not reach the translation service. Check the internet connection."); throw e; }
  }

  /* ---------- voice (Web Speech API) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;
  /** Recorder: langs = up to 3 speech tags; the first is used to start. If the engine hears nothing it can match, it moves to the next language. */
  function Recorder(o) {
    let rec = null, on = false, paused = false, li = 0, langs = (o.langs && o.langs.length ? o.langs : ["en-IN"]).slice(0, 3), miss = 0, lastEnd = 0, stopping = false;
    const emit = (k, v) => { try { o[k] && o[k](v); } catch (e) { /* the caller's handler failed; keep listening */ } };
    function build() {
      rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1; rec.lang = langs[li];
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i], t = r[0].transcript;
          if (r.isFinal) { miss = 0; const c = r[0].confidence; emit("onfinal", { text: t.trim(), lang: langs[li], confidence: c }); if (langs.length > 1 && c > 0 && c < 0.35) next(); } else interim += t;
        }
        emit("oninterim", { text: interim, lang: langs[li] });
      };
      rec.onnomatch = () => { miss++; if (langs.length > 1 && miss >= 2) next(); };
      rec.onerror = (e) => {
        if (e.error === "no-speech") { miss++; if (langs.length > 1 && miss >= 3) next(); return; }
        if (e.error === "aborted") return;
        if (e.error === "language-not-supported") { emit("onerror", { code: e.error, message: "This browser cannot listen in " + langs[li] + ". Choose another language, or type the points." }); if (langs.length > 1) next(); else stop(); return; }
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { emit("onerror", { code: e.error, message: "The microphone is blocked. Allow it for this site in the browser address bar, then press Start again." }); on = false; emit("onstate", "stopped"); return; }
        emit("onerror", { code: e.error, message: "Voice capture problem: " + e.error });
      };
      rec.onend = () => {   // the engine stops by itself after silence: start it again while the meeting is still being recorded
        if (!on || paused || stopping) { emit("onstate", paused ? "paused" : "stopped"); return; }
        const gap = Date.now() - lastEnd; lastEnd = Date.now();
        setTimeout(() => { if (on && !paused) { try { build(); rec.start(); } catch (x) { /* already started */ } } }, gap < 800 ? 600 : 50);
      };
    }
    function next() { li = (li + 1) % langs.length; miss = 0; emit("onlang", langs[li]); try { rec.abort(); } catch (e) { /* ignore */ } }
    function start() { if (!supported) { emit("onerror", { code: "unsupported", message: "Voice capture needs Chrome, Edge or Safari. You can still type the points." }); return; } on = true; paused = false; stopping = false; miss = 0; build(); try { rec.start(); emit("onstate", "listening"); emit("onlang", langs[li]); } catch (e) { emit("onerror", { code: "start", message: "Could not start the microphone: " + e.message }); } }
    function pause() { paused = true; try { rec.stop(); } catch (e) { /* ignore */ } emit("onstate", "paused"); }
    function resume() { paused = false; on = true; build(); try { rec.start(); emit("onstate", "listening"); } catch (e) { /* ignore */ } }
    function stop() { stopping = true; on = false; paused = false; try { rec.stop(); } catch (e) { /* ignore */ } emit("onstate", "stopped"); }
    function setLang(tag) { const i = langs.indexOf(tag); if (i >= 0) li = i; else { langs[li] = tag; } try { rec.abort(); } catch (e) { /* restarts through onend */ } emit("onlang", langs[li]); }
    return { start, pause, resume, stop, setLang, setLangs(a) { langs = a.slice(0, 3); li = 0; }, get lang() { return langs[li]; }, get active() { return on && !paused; } };
  }

  /* ---------- tiny help for who / when from a spoken sentence (English) ---------- */
  const WD = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"], MO = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function guessWhen(text, base) {
    const t = String(text || "").toLowerCase(), d0 = base ? new Date(base + "T00:00:00Z") : new Date(), d = (n) => { const x = new Date(d0); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    if (/\btoday\b/.test(t)) return d(0); if (/\btomorrow\b/.test(t)) return d(1);
    let m = t.match(/\b(?:by|before|on|till|until)?\s*(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (m) { const want = WD.indexOf(m[1]); let n = (want - d0.getUTCDay() + 7) % 7; if (n === 0) n = 7; return d(n); }
    m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(\d{4}))?/);
    if (m) { const y = m[3] ? +m[3] : d0.getUTCFullYear(); const x = new Date(Date.UTC(y, MO.indexOf(m[2]), +m[1])); if (!m[3] && x < d0) x.setUTCFullYear(y + 1); return x.toISOString().slice(0, 10); }
    m = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
    if (m) { let y = m[3] ? +m[3] : d0.getUTCFullYear(); if (y < 100) y += 2000; const x = new Date(Date.UTC(y, +m[2] - 1, +m[1])); if (!isNaN(x)) return x.toISOString().slice(0, 10); }
    if (/\bnext week\b/.test(t)) return d(7); if (/\bnext month\b/.test(t)) return d(30); if (/\bend of (?:the )?week\b/.test(t)) return d((5 - d0.getUTCDay() + 7) % 7);
    return "";
  }
  function guessWho(text, names) {
    const t = String(text || "").toLowerCase(), hit = []; (names || []).forEach((n) => { const p = String(n || "").trim(); if (!p) return; const first = p.split(/\s+/)[0].toLowerCase(); if (t.includes(p.toLowerCase()) || (first.length > 2 && new RegExp("\\b" + first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(t))) hit.push(p); });
    return [...new Set(hit)].join(", ");
  }
  /* ---------- frame: turn spoken / typed discussion text into tidy points (rule based, no AI service) ---------- */
  const NUMW = "one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth";
  const MARK = new RegExp("\\b(?:(?:point|item|topic|agenda)\\s*(?:number|no\\.?|#)?\\s*(?:\\d{1,2}|" + NUMW + ")|(?:next|another|last|final)\\s+(?:point|item)|number\\s*\\d{1,2})\\b[\\s,:.\\-–]*", "gi");
  const LEAD = /^([\s\S]*?)\b(?:(?:the\s+)?(?:list|points?|items?|agenda|topics?|following|issues?)\s+(?:is|are|as follows|for today|today)|as follows|the following|following)\b[\s:,\-–]*([\s\S]*)$/i;
  const FILL = /\b(?:um+|uh+|er+|erm|hmm+|you know|i mean|basically|actually|okay|ok|so basically|kind of|sort of|like i said)\b[\s,]*/gi;
  const cap = (s) => { s = s.trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  function tidy(s) {
    s = String(s || "").replace(FILL, " ").replace(/\s+/g, " ").replace(/\s+([,.;:?!])/g, "$1").replace(/^[\s,.;:\-–]+/, "").replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
    s = s.replace(/^(?:and|then|so|also|that|is|are|of|to|the next|ok)\b[\s,]*/i, "").replace(/[\s,;:\-–]+$/, "").trim();
    return cap(s);
  }
  function kind(t) {
    const x = t.toLowerCase();
    if (/\b(decided|decision|agreed|approved|finalised|finalized|freeze[d]?|confirmed)\b/.test(x)) return "Decision";
    if (/\b(risk|concern|problem|issue|delay(?:ed)?|failure|rejection|complaint|breakdown|shortage|late)\b/.test(x)) return "Risk / concern";
    if (/\?|\b(query|clarify|clarification|doubt)\b/.test(x)) return "Query";
    if (/\b(should|must|need(?:s)? to|will|shall|please|to be (?:done|completed|prepared)|action|ensure|follow ?up|by (?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|before|deadline|prepare|complete|submit|arrange|plan(?:ning)?)\b/.test(x) && /\b(should|must|need(?:s)? to|will|shall|please|to be|ensure|follow ?up|by |before|deadline|prepare|complete|submit|arrange)\b/.test(x)) return "Action";
    if (/\b(informed|information|update|status|reported|noted|fyi|for your information)\b/.test(x)) return "Information";
    return "Discussion";
  }
  /** lines = array of text lines (or one string). opts: names (attendees), today (yyyy-mm-dd). Returns {topic, points:[{what,ptype,who,when_on}]} */
  function frame(lines, opts) {
    opts = opts || {}; const names = opts.names || [], base = opts.today;
    const text = (Array.isArray(lines) ? lines : [lines]).map((l) => String(l || "").trim()).filter(Boolean).join("\n");
    let chunks = text.split(MARK).map((c) => c.replace(/[ \t]+/g, " ").trim()).filter(Boolean), topic = "";
    const marked = chunks.length > 1;
    if (chunks.length) { const m = chunks[0].match(LEAD); if (m && m[2].trim() && (marked || chunks.length === 1)) { topic = tidy(m[1]); chunks[0] = m[2]; } else if (m && !m[2].trim() && m[1].trim()) { topic = tidy(m[1]); chunks.shift(); } }
    if (!marked) {   // no "point number" words: use the lines and the sentences
      const out = []; chunks.forEach((c) => c.split(/\n+/).forEach((ln) => ln.split(/(?<=[.?!।])\s+/).forEach((s) => {
        const parts = s.split(/\s*(?:,\s*)?\b(?:also|additionally|next|another thing|further|moreover|in addition)\b\s*,?\s*/i).filter((q) => q.trim());
        if (parts.length > 1 && parts.every((q) => q.trim().split(/\s+/).length >= 4)) out.push(...parts); else out.push(s);
      })));
      chunks = out;
    }
    const points = chunks.map((c) => tidy(c)).filter((c) => c.length > 2).map((w) => ({ what: w, ptype: kind(w), who: guessWho(w, names), when_on: guessWhen(w, base) || null }));
    return { topic, points };
  }
  window.MOMLang = { list: L, byTag, label, detect, translate, Recorder, supported, guessWhen, guessWho, frame };
})();
