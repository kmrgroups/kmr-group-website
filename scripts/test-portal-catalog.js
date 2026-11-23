/* Guard: every KMR app (one with a card illustration public/img/kmr/app-<code>.svg) must have a colour + description (META),
   sit in a launcher group, and be in the card-art list of apps/portal.js - so a new app never shows a bare, grey card.
   Run: node scripts/test-portal-catalog.js */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "public");
const src = fs.readFileSync(path.join(root, "it/apps/portal.js"), "utf8");
const codes = fs.readdirSync(path.join(root, "img/kmr")).map((f) => (f.match(/^app-([a-z0-9]+)\.svg$/) || [])[1]).filter(Boolean);
const meta = new Set([...src.matchAll(/^\s{4}([a-z0-9]+): \{ color: "#[0-9A-Fa-f]{6}", desc: "([^"]{20,})"/gm)].map((m) => m[1]));
const groups = (src.match(/const GROUPS = (.*?);\n/) || [])[1] || "";
const art = (src.match(/const ART = \{(.*?)\};/s) || [])[1] || "";
let bad = 0;
for (const c of codes) {
  const miss = [];
  if (!meta.has(c)) miss.push("colour + description (META)");
  if (!new RegExp('"' + c + '"').test(groups)) miss.push("launcher group (GROUPS)");
  if (!new RegExp("\\b" + c + ": 1").test(art)) miss.push("card art list (ART)");
  if (miss.length) { bad++; console.log("FAIL " + c + " is missing: " + miss.join(", ")); }
}
console.log(bad ? bad + " app(s) incomplete" : "OK - all " + codes.length + " apps have a full portal card");
process.exit(bad ? 1 : 0);
