"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import { DEPARTMENTS } from "@/lib/resources";
import type { Employee } from "@/lib/types";

const empty: Partial<Employee> = {
  employee_code: "", full_name: "", department: "", designation: "",
  email: "", phone: "", date_of_joining: "", pf_number: "", is_active: true
};

function EmployeesContent() {
  const { can } = useAdminAccess();
  const canCreate = can("employees", "create");
  const canUpdate = can("employees", "update");
  const canDelete = can("employees", "delete");

  const [items, setItems] = useState<Employee[]>([]);
  const [form, setForm] = useState<Partial<Employee>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("employees").select("*").order("full_name");
    setItems((data as Employee[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.employee_code || !form.full_name) { alert("Employee code and name are required."); return; }
    setSaving(true);
    const { error } = form.id
      ? await supabase.from("employees").update(form).eq("id", form.id)
      : await supabase.from("employees").insert(form);
    setSaving(false);
    if (!error) { setForm(empty); load(); } else { alert(error.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this employee record?")) return;
    await supabase.from("employees").delete().eq("id", id);
    load();
  }

  const showForm = canCreate || (form.id && canUpdate);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Operations · HRM Foundation</p>
      <h1 className="font-display text-4xl mb-8">Employees</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {showForm && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">{form.id ? "Edit Employee" : "Add New Employee"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Employee code" value={form.employee_code || ""} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} className="border border-line px-3 py-2 text-sm" />
              <input placeholder="Full name" value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="border border-line px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} className="border border-line px-3 py-2 text-sm">
                <option value="">Department</option>
                {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              <input placeholder="Designation" value={form.designation || ""} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="border border-line px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border border-line px-3 py-2 text-sm" />
              <input placeholder="Phone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border border-line px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate mb-1">Date of joining</label>
                <input type="date" value={form.date_of_joining || ""} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
              </div>
              <input placeholder="PF Number" value={form.pf_number || ""} onChange={(e) => setForm({ ...form, pf_number: e.target.value })} className="border border-line px-3 py-2 text-sm self-end" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                {saving ? "Saving…" : form.id ? "Update" : "Add Employee"}
              </button>
              {form.id && <button onClick={() => setForm(empty)} className="text-sm text-slate underline">Cancel edit</button>}
            </div>
          </div>
        )}

        <div className={showForm ? "" : "lg:col-span-2"}>
          <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-slate font-mono">No employees yet.</p>}
            {items.map((e) => (
              <div key={e.id} className="plate bg-white p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{e.full_name} {!e.is_active && <span className="text-xs text-red-600">(inactive)</span>}</p>
                  <p className="text-xs text-slate font-mono">{e.employee_code} · {e.designation} · {e.department}</p>
                </div>
                {canUpdate && <button onClick={() => setForm(e)} className="text-xs text-steel underline">Edit</button>}
                {canDelete && <button onClick={() => handleDelete(e.id)} className="text-xs text-red-600 underline">Delete</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminEmployeesPage() {
  return (
    <PermissionGate resource="employees">
      <EmployeesContent />
    </PermissionGate>
  );
}
