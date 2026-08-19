"use client";
import Link from "next/link";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { Resource } from "@/lib/types";

const cards: { href: string; title: string; desc: string; resource?: Resource; adminOnly?: boolean }[] = [
  { href: "/admin/hero", title: "Hero Banner", desc: "Edit homepage headline, subheadline and banner image.", resource: "hero_content" },
  { href: "/admin/leadership", title: "Leadership", desc: "Add, edit or remove management team profiles.", resource: "leaders" },
  { href: "/admin/verticals", title: "Verticals", desc: "Manage the business verticals shown on the site.", resource: "verticals" },
  { href: "/admin/gallery", title: "Gallery", desc: "Upload and manage photos and promo videos.", resource: "gallery_items" },
  { href: "/admin/products", title: "Products", desc: "Manage your product catalog, pricing and stock.", resource: "products" },
  { href: "/admin/orders", title: "Orders", desc: "View orders placed and paid for through Razorpay checkout.", resource: "orders" },
  { href: "/admin/compliance", title: "Finance & Compliance", desc: "GST, Udyam, trademark, licenses and renewal reminders.", resource: "compliance_records" },
  { href: "/admin/operations/customers", title: "Customers", desc: "Customer master records for sales and invoicing.", resource: "customers" },
  { href: "/admin/operations/vendors", title: "Vendors", desc: "Supplier master records for purchasing.", resource: "vendors" },
  { href: "/admin/operations/items", title: "Items Master", desc: "Raw materials, finished goods, trading items and services.", resource: "inventory_items" },
  { href: "/admin/operations/warehouses", title: "Warehouses", desc: "Storage locations for inventory tracking.", resource: "warehouses" },
  { href: "/admin/operations/stock", title: "Stock Ledger", desc: "Record stock movements and see current stock on hand.", resource: "stock_transactions" },
  { href: "/admin/operations/employees", title: "Employees", desc: "Employee master records — foundation for HRM.", resource: "employees" },
  { href: "/admin/legal", title: "Legal Pages", desc: "Edit Terms, Privacy, Refund, Shipping and Grievance content.", resource: "legal_pages" },
  { href: "/admin/company", title: "Company Info", desc: "Registered address, GSTIN, CIN, socials and map location.", resource: "company_info" },
  { href: "/admin/staff", title: "Staff & Permissions", desc: "Create department logins and control what each can access.", adminOnly: true }
];

export default function AdminDashboardPage() {
  const { isAdmin, can, profile } = useAdminAccess();
  const visible = cards.filter((c) => (c.adminOnly ? isAdmin : c.resource ? can(c.resource, "read") : true));

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Welcome{profile ? `, ${profile.full_name}` : ""}</p>
      <h1 className="font-display text-4xl mb-8">Admin Dashboard</h1>
      {visible.length === 0 ? (
        <p className="text-sm text-slate font-mono">
          You don't have access to any sections yet — ask an admin to grant permissions.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((c) => (
            <Link key={c.href} href={c.href} className="plate bg-white p-6 hover:border-copper transition-colors">
              <h3 className="font-display text-xl mb-2">{c.title}</h3>
              <p className="text-sm text-slate">{c.desc}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
