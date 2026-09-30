import Link from "next/link";

export default function NotFound() {
  return (
    <section className="pattern-navy py-32 text-center text-white">
      <div className="wrap">
        <p className="font-display text-8xl font-semibold text-gold">404</p>
        <h1 className="h-display mt-4 text-4xl">This page could not be found</h1>
        <p className="mx-auto mt-4 max-w-lg text-white/70">It may have moved, or the link may be incomplete.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3"><Link href="/" className="btn-gold">Go to the home page</Link><Link href="/contact" className="btn-outline-light">Contact us</Link></div>
      </div>
    </section>
  );
}
