"use client";
import { ReactNode } from "react";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { Resource } from "@/lib/types";

/**
 * Wrap any admin page's content in this. Shows a friendly "no access"
 * message instead of the page if the logged-in staff member doesn't
 * have read permission on this resource.
 */
export default function PermissionGate({ resource, children }: { resource: Resource; children: ReactNode }) {
  const { loading, can } = useAdminAccess();

  if (loading) {
    return <p className="text-sm text-slate font-mono">Checking your access…</p>;
  }
  if (!can(resource, "read")) {
    return (
      <div className="plate bg-white p-8 max-w-lg">
        <p className="eyebrow text-red-600 mb-2">Access Restricted</p>
        <h2 className="font-display text-2xl mb-2">You don't have access to this section</h2>
        <p className="text-sm text-slate">
          Ask an admin to grant you permission from Admin → Staff & Permissions if you believe this is a mistake.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
