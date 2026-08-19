"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { PermissionsMap, Resource, StaffProfile } from "@/lib/types";
import { RESOURCES, emptyPermissionSet } from "@/lib/resources";

type AdminAccessValue = {
  loading: boolean;
  profile: StaffProfile | null;
  permissions: PermissionsMap;
  isAdmin: boolean;
  can: (resource: Resource, action: "create" | "read" | "update" | "delete") => boolean;
  noProfileFound: boolean;
};

const defaultPermissions = Object.fromEntries(
  RESOURCES.map((r) => [r.key, emptyPermissionSet()])
) as PermissionsMap;

const AdminAccessContext = createContext<AdminAccessValue>({
  loading: true,
  profile: null,
  permissions: defaultPermissions,
  isAdmin: false,
  can: () => false,
  noProfileFound: false
});

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [permissions, setPermissions] = useState<PermissionsMap>(defaultPermissions);
  const [noProfileFound, setNoProfileFound] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: profileRow } = await supabase
        .from("staff_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!profileRow) {
        setNoProfileFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileRow as StaffProfile);

      if (!profileRow.is_admin) {
        const { data: permRows } = await supabase
          .from("staff_permissions")
          .select("*")
          .eq("staff_id", userId);

        const map = { ...defaultPermissions };
        (permRows || []).forEach((row: any) => {
          map[row.resource as Resource] = {
            create: row.can_create,
            read: row.can_read,
            update: row.can_update,
            delete: row.can_delete
          };
        });
        setPermissions(map);
      }

      setLoading(false);
    }
    load();
  }, []);

  function can(resource: Resource, action: "create" | "read" | "update" | "delete") {
    if (!profile) return false;
    if (profile.is_admin) return true;
    return permissions[resource]?.[action] || false;
  }

  return (
    <AdminAccessContext.Provider
      value={{ loading, profile, permissions, isAdmin: !!profile?.is_admin, can, noProfileFound }}
    >
      {children}
    </AdminAccessContext.Provider>
  );
}

export function useAdminAccess() {
  return useContext(AdminAccessContext);
}
