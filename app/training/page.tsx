import { supabase } from "@/lib/supabaseClient";
import ProductCard from "@/components/ProductCard";
import EnquiryForm from "@/components/EnquiryForm";
import { PageHero, SectionHead } from "@/components/Blocks";
import { IconCap, IconCheck, IconUsers, IconShield } from "@/components/Icons";
import type { Product } from "@/lib/types";

export const revalidate = 30;
export const metadata = { title: "Training & development", description: "Practical programmes on quality, core tools and digital manufacturing — public courses and in-house training." };

const WAYS = [
  { icon: IconCap, t: "Public programmes", d: "Scheduled courses — enrol online and pay securely." },
  { icon: IconUsers, t: "In-house training", d: "At your plant, on your dates, with examples from your own parts and processes." },
  { icon: IconShield, t: "Certification support", d: "IATF 16949, ISO 9001 and customer-specific requirements — prepared, not just explained." },
];

export default async function TrainingPage() {
  const { data } = await supabase.from("products").select("*").eq("is_active", true).eq("business", "training").order("sort_order").order("created_at", { ascending: false });
  const courses = (data as Product[]) || [];
  return (
    <>
      <PageHero eyebrow="Training & development" title="Skills that move the shop floor" intro="Programmes taught by practitioners — quality systems, core tools (APQP, PPAP, FMEA, SPC, MSA), problem solving and digital manufacturing." />
      <section className="bg-white py-16">
        <div className="wrap grid gap-6 md:grid-cols-3">
          {WAYS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-5 p-2"><span className="grid h-14 w-14 shrink-0 place-items-center bg-navy text-gold-light"><Icon className="h-6 w-6" /></span>
              <div><h3 className="font-display text-xl font-semibold text-navy">{t}</h3><p className="mt-1 text-sm leading-relaxed text-muted">{d}</p></div></div>
          ))}
        </div>
      </section>
      <section className="py-20">
        <div className="wrap">
          <SectionHead eyebrow="Programmes" title={courses.length ? "Upcoming programmes" : "Programme calendar coming soon"} intro={courses.length ? "Enrol online, or ask us to run any programme for your team." : "Tell us what your team needs and we will plan it with you."} />
          {courses.length > 0 && <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{courses.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
        </div>
      </section>
      <section className="pattern-navy py-20 text-white">
        <div className="wrap grid items-start gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow eyebrow-light mb-4">Corporate training</p>
            <h2 className="h-display text-3xl md:text-[44px]">Training designed around your plant</h2>
            <ul className="mt-8 space-y-3 text-white/80">{["Needs assessment with your quality and production heads", "Your own drawings, PFMEAs and control plans as case studies", "Assessments and certificates for every participant", "Follow-up support after the programme"].map((x) => <li key={x} className="flex gap-3"><IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />{x}</li>)}</ul>
          </div>
          <EnquiryForm business="training" dark title="Plan a programme" intro="Topic, number of participants and location." askQuantity submitLabel="Send request" />
        </div>
      </section>
    </>
  );
}
