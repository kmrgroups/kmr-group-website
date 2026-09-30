import { supabase } from "@/lib/supabaseClient";
import ProductCard from "@/components/ProductCard";
import EnquiryForm from "@/components/EnquiryForm";
import type { Product } from "@/lib/types";

export const revalidate = 30;
export const metadata = { title: "Training & Education · KMR Group of Companies", description: "Practical courses on quality, core tools and digital manufacturing." };

export default async function TrainingPage() {
  const { data } = await supabase.from("products").select("*").eq("is_active", true).eq("business", "training").order("sort_order").order("created_at", { ascending: false });
  const courses = (data as Product[]) || [];
  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">Training & Education</p>
      <h1 className="font-display text-5xl mb-4">Courses</h1>
      <p className="text-slate max-w-2xl mb-12">Practical programmes taught by practitioners with years on the shop floor — IATF 16949, core tools (APQP, PPAP, FMEA, SPC, MSA), problem solving and digital manufacturing. On site at your plant or online.</p>
      {courses.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">{courses.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <p className="text-sm text-slate font-mono mb-16">The next course calendar is being prepared — tell us what your team needs below.</p>
      )}
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div>
          <h2 className="font-display text-3xl mb-3">Training for your company</h2>
          <p className="text-slate">We run any course in-house for your team, on dates that suit you, with examples from your own parts and processes. Tell us the topic, the number of people and the location.</p>
        </div>
        <EnquiryForm business="training" title="Ask about a course" askQuantity submitLabel="Send enquiry" />
      </div>
    </div>
  );
}
