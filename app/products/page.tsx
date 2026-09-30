import { redirect } from "next/navigation";

// The catalogue moved to /shop (goods), /training (courses) and /trade (quotes); old links keep working.
export default function ProductsPage() {
  redirect("/shop");
}
