/**
 * Built-in illustrations (public/img/kmr, made by scripts/make-art.py). A photo uploaded in
 * KMR Console › Website CMS always wins; these fill every place that has no photo yet, so no card is bare text.
 */
const A = (n: string) => `/img/kmr/${n}.svg`;

/** KMR Apps by product code; new apps without their own picture get the general software scene */
export function appArt(code: string, uploaded?: string | null): string {
  if (uploaded) return uploaded;
  return ["hrm", "balloon", "pd", "capacity", "sales", "calib"].includes(code) ? A(`app-${code}`) : A("v-software");
}

/** Business verticals by slug / link */
export function verticalArt(v: { slug?: string | null; link?: string | null; code?: string | null; image_url?: string | null }): string {
  if (v.image_url) return v.image_url;
  const k = `${v.slug ?? ""} ${v.link ?? ""} ${v.code ?? ""}`.toLowerCase();
  if (/soft/.test(k)) return A("v-software");
  if (/train|learn|course/.test(k)) return A("v-training");
  if (/invest|partner/.test(k)) return A("v-invest");
  if (/retail|trading/.test(k) && !/export|import/.test(k)) return A("v-shop");
  if (/trade|export|import|distribut/.test(k)) return A("v-trade");
  return A("v-shop");
}

/** Shop items, programmes and services: the topic decides the picture */
export function productArt(p: { image_url?: string | null; business?: string | null; kind?: string | null; name?: string | null; category?: string | null }): string {
  if (p.image_url) return p.image_url;
  const t = `${p.name ?? ""} ${p.category ?? ""}`.toLowerCase();
  if (p.business === "training" || p.kind === "course") {
    if (/core tool|apqp|ppap|fmea|spc|msa/.test(t)) return A("t-coretools");
    if (/8d|problem|root cause|kaizen/.test(t)) return A("t-problem");
    if (/supervisor|shop ?floor|5s|lean|excellence|tpm/.test(t)) return A("t-shopfloor");
    return A("t-quality");
  }
  if (p.business === "software") {
    if (/consult|erp|advis/.test(t)) return A("s-consulting");
    if (/web|store|e-?commerce|site/.test(t)) return A("s-web");
    return A("s-custom");
  }
  if (p.business === "import_export" || p.business === "trading" || p.business === "distribution") return A("v-trade");
  return A("v-shop");
}
