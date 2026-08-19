"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import { RESOURCES, DEPARTMENTS, emptyPermissionSet } from "@/lib/resources";
import type { PermissionsMap, Resource, StaffProfile } from "@/lib/types";

const emptyPermissions = Object.fromEntries(RESOURCES.map((r) => [r.key, emptyPermissionSet()])) as PermissionsMap;

export default function AdminStaffPage() {
  const { isAdmin, loading: accessLoading } = useAdminAccess();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("sales");
  const [asAdmin, setAsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsMap>(emptyPermissions);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("staff_profiles").select("*").order("created_at");
    setStaff((data as StaffProfile[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  function togglePermission(resource: Resource, action: keyof (typeof emptyPermissions)[Resource]) {
    setPermissions((prev) => ({
      ...prev,
      [resource]: { ...prev[resource], [action]: !prev[resource][action] }
    }));
  }

  async function handleCreate() {
    setMessage("");
    if (!fullName || !email || !password) {
      setMessage("Please fill in name, email and password.");
      return;
    }
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, password, fullName, department, isAdmin: asAdmin, permissions })
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage(`Error: ${data.error}`);
      return;
    }
    setMessage("Staff login created.");
    setFullName("");
    setEmail("");
    setPassword("");
    setDepartment("sales");
    setAsAdmin(false);
    setPermissions(emptyPermissions);
    load();
  }

  async function handleDeactivate(staffId: string) {
    if (!confirm("Deactivate this staff login? They won't be able to sign in anymore.")) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/delete-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ staffId })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    load();
  }

  if (accessLoading) return <p className="text-sm text-slate font-mono">Checking your access…</p>;
  if (!isAdmin) {
    return (
      <div className="plate bg-white p-8 max-w-lg">
        <p className="eyebrow text-red-600 mb-2">Admin Only</p>
        <h2 className="font-display text-2xl mb-2">Only admins can manage staff logins</h2>
        <p className="text-sm text-slate">Ask your admin if you need a new department login created.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Access Control</p>
      <h1 className="font-display text-4xl mb-8">Staff & Permissions</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Create new staff login */}
        <div className="plate bg-white p-6 space-y-4 h-fit">
          <h2 className="font-display text-xl">Add a Department Login</h2>
          <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-line px-3 py-2 text-sm" />
          <input placeholder="Email (used to log in)" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-line px-3 py-2 text-sm" />
          <input placeholder="Password (min 8 characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-line px-3 py-2 text-sm" />
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full border border-line px-3 py-2 text-sm">
              {DEPARTMENTS.filter((d) => d.key !== "admin").map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} />
            Give this login full admin access (skips the permission grid below)
          </label>

          {!asAdmin && (
            <div>
              <p className="text-sm font-medium mb-2">Permissions</p>
              <div className="border border-line overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-warehouse">
                      <th className="text-left p-2">Section</th>
                      <th className="p-2">Create</th>
                      <th className="p-2">Read</th>
                      <th className="p-2">Update</th>
                      <th className="p-2">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCES.map((r) => (
                      <tr key={r.key} className="border-t border-line">
                        <td className="p-2">{r.label}</td>
                        {(["create", "read", "update", "delete"] as const).map((action) => (
                          <td key={action} className="text-center p-2">
                            <input
                              type="checkbox"
                              checked={permissions[r.key][action]}
                              onChange={() => togglePermission(r.key, action)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button onClick={handleCreate} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
            {saving ? "Creating…" : "Create Login"}
          </button>
          {message && <p className="text-sm text-slate">{message}</p>}
        </div>

        {/* Existing staff list */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate font-mono">Loading…</p>
          ) : staff.length === 0 ? (
            <p className="text-sm text-slate font-mono">No staff logins yet besides your own.</p>
          ) : (
            staff.map((s) => (
              <div key={s.id} className="plate bg-white p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">
                    {s.full_name} {!s.is_active && <span className="text-xs text-red-600">(deactivated)</span>}
                  </p>
                  <p className="text-xs text-slate font-mono">
                    {s.email} · {s.is_admin ? "Admin" : s.department}
                  </p>
                </div>
                {s.is_active && (
                  <button onClick={() => handleDeactivate(s.id)} className="text-xs text-red-600 underline">
                    Deactivate
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
