import Link from "next/link";
import FitImage from "@/components/FitImage";

/** Navy page banner with eyebrow, title, intro and breadcrumb. */
export function PageHero({ eyebrow, title, intro, crumbs = [], image, children }: {
  eyebrow?: string; title: string; intro?: string | null; crumbs?: [string, string?][]; image?: string | null; children?: React.ReactNode;
}) {
  return (
    <section className="pattern-navy relative overflow-hidden text-white">
      {image && (
        <>
          <FitImage src={image} className="absolute inset-0 opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/40" />
        </>
      )}
      <div className="wrap relative py-12 md:py-16">
        <nav className="mb-6 text-[12.5px] text-white/55" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-gold-light">Home</Link>
          {crumbs.map(([label, href]) => <span key={label}> <span className="mx-1.5 text-gold/70">/</span> {href ? <Link href={href} className="hover:text-gold-light">{label}</Link> : <span className="text-white/80">{label}</span>}</span>)}
          {!crumbs.length && <span> <span className="mx-1.5 text-gold/70">/</span> <span className="text-white/80">{title}</span></span>}
        </nav>
        {eyebrow && <p className="eyebrow eyebrow-light mb-4">{eyebrow}</p>}
        <h1 className="h-display max-w-3xl text-3xl md:text-[42px]">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75">{intro}</p>}
        {children}
      </div>
      <div className="h-1 bg-gradient-to-r from-gold via-gold-light to-gold" />
    </section>
  );
}

/** Section heading: eyebrow, serif title and intro; centred or left. */
export function SectionHead({ eyebrow, title, intro, center, light, action }: {
  eyebrow?: string; title: string; intro?: string | null; center?: boolean; light?: boolean; action?: React.ReactNode;
}) {
  return (
    <div className={`mb-8 flex flex-col gap-5 ${center ? "items-center text-center" : "md:flex-row md:items-end md:justify-between"}`}>
      <div className={center ? "max-w-3xl" : "max-w-3xl"}>
        {eyebrow && <p className={`eyebrow mb-4 ${light ? "eyebrow-light" : ""}`}>{eyebrow}</p>}
        <h2 className={`h-display text-2xl md:text-[32px] ${light ? "text-white" : "text-navy"}`}>{title}</h2>
        {intro && <p className={`mt-4 text-[17px] leading-relaxed ${light ? "text-white/70" : "text-muted"}`}>{intro}</p>}
      </div>
      {action}
    </div>
  );
}

/** Long text from the CMS: blank line = paragraph, "# " = heading, "- " = bullet. */
export function RichText({ text, className = "" }: { text?: string | null; className?: string }) {
  // blank line = new block; "# " = heading; lines starting "- " = bullet list (a heading may be followed by bullets or text)
  const blocks = (text ?? "").replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const isBullet = (l: string) => /^[-•*]\s+/.test(l.trim());
  const body = (ls: string[], key: string) => ls.length === 0 ? null : ls.every(isBullet)
    ? <ul key={key}>{ls.map((l, j) => <li key={j}>{l.trim().replace(/^[-•*]\s+/, "")}</li>)}</ul>
    : <p key={key} className="whitespace-pre-line">{ls.join("\n")}</p>;
  return (
    <div className={`prose-kmr ${className}`}>
      {blocks.map((b, i) => {
        const ls = b.split("\n");
        if (/^#{1,3}\s+/.test(ls[0])) return <div key={i}><h2>{ls[0].replace(/^#{1,3}\s+/, "")}</h2>{body(ls.slice(1), "b")}</div>;
        return body(ls, String(i));
      })}
    </div>
  );
}

/** Dark call-to-action band. */
export function CtaBand({ title, text, primary, secondary }: { title: string; text?: string; primary: [string, string]; secondary?: [string, string] }) {
  return (
    <section className="bg-ivory py-20">
      <div className="wrap">
        <div className="pattern-navy relative overflow-hidden px-8 py-14 text-white md:px-14">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-gold/20" />
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full border border-gold/30" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="h-display text-2xl md:text-[30px]">{title}</h2>
              {text && <p className="mt-3 text-white/70">{text}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href={primary[1]} className="btn-gold">{primary[0]}</Link>
              {secondary && <Link href={secondary[1]} className="btn-outline-light">{secondary[0]}</Link>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
