"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AdminAccessProvider, useAdminAccess } from "@/lib/AdminAccessContext";
import type { Resource } from "@/lib/types";

type NavItem = { href: string; label: string; resource?: Resource; adminOnly?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Website",
    items: [
      { href: "/admin/hero", label: "Hero Banner", resource: "hero_content" },
      { href: "/admin/leadership", label: "Leadership", resource: "leaders" },
      { href: "/admin/verticals", label: "Verticals", resource: "verticals" },
      { href: "/admin/gallery", label: "Gallery", resource: "gallery_items" },
      { href: "/admin/products", label: "Products", resource: "products" },
      { href: "/admin/orders", label: "Orders", resource: "orders" },
      { href: "/admin/legal", label: "Legal Pages", resource: "legal_pages" },
      { href: "/admin/company", label: "Company Info", resource: "company_info" }
    ]
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/operations/customers", label: "Customers", resource: "customers" },
      { href: "/admin/operations/vendors", label: "Vendors", resource: "vendors" },
      { href: "/admin/operations/items", label: "Items Master", resource: "inventory_items" },
      { href: "/admin/operations/warehouses", label: "Warehouses", resource: "warehouses" },
      { href: "/admin/operations/stock", label: "Stock Ledger", resource: "stock_transactions" },
      { href: "/admin/operations/employees", label: "Employees", resource: "employees" }
    ]
  },
  {
    label: "Finance & Access",
    items: [
      { href: "/admin/compliance", label: "Finance & Compliance", resource: "compliance_records" },
      { href: "/admin/staff", label: "Staff & Permissions", adminOnly: true }
    ]
  }
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, profile, isAdmin, can, noProfileFound } = useAdminAccess();

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-slate font-mono text-sm">Checking your access…</div>;
  }

  if (noProfileFound) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-5">
        <div className="plate bg-white p-8 max-w-lg">
          <p className="eyebrow text-red-600 mb-2">Setup Needed</p>
          <h2 className="font-display text-2xl mb-3">No staff profile found for this login</h2>
          <p className="text-sm text-slate leading-relaxed">
            Your Supabase Auth login exists, but there's no matching row in{" "}
            <code className="font-mono text-xs bg-warehouse px-1">staff_profiles</code> yet. If this is your
            original admin account, run the bootstrap SQL from{" "}
            <code className="font-mono text-xs bg-warehouse px-1">supabase/add-permissions-and-compliance.sql</code>{" "}
            with your real Auth User UID to mark yourself as admin.
          </p>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.adminOnly) return isAdmin;
        if (!item.resource) return true;
        return can(item.resource, "read");
      })
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-[80vh]">
      <aside className="w-56 shrink-0 bg-ink text-warehouse hidden md:block overflow-y-auto">
        <div className="p-5 border-b border-white/10">
          <p className="font-display text-xl">Admin Panel</p>
          {profile && (
            <p className="text-xs text-slate-light mt-1 font-mono">
              {profile.full_name} · {isAdmin ? "Admin" : profile.department}
            </p>
          )}
        </div>
        <nav className="p-3 space-y-4 text-sm pb-6">
          <Link
            href="/admin/dashboard"
            className={`block px-3 py-2 rounded hover:bg-white/5 ${
              pathname === "/admin/dashboard" ? "bg-white/10 text-copper-light" : "text-slate-light"
            }`}
          >
            Dashboard
          </Link>
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="eyebrow text-slate px-3 mb-1">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-3 py-2 rounded hover:bg-white/5 ${
                      pathname === item.href ? "bg-white/10 text-copper-light" : "text-slate-light"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/5 rounded"
          >
            Log out
          </button>
        </nav>
      </aside>
      <div className="flex-1 bg-warehouse p-6 md:p-10">{children}</div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/admin/login");
      } else {
        setAuthed(true);
      }
      setChecking(false);
    });
  }, [pathname, router]);

  if (pathname === "/admin/login") return <>{children}</>;
  if (checking) {
    return <div className="min-h-[60vh] flex items-center justify-center text-slate font-mono text-sm">Checking session…</div>;
  }
  if (!authed) return null;

  return (
    <AdminAccessProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAccessProvider>
  );
}
