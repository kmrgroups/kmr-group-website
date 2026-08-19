import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const RESOURCES = [
  "hero_content", "leaders", "verticals", "gallery_items", "products",
  "orders", "legal_pages", "company_info", "compliance_records"
] as const;

// Verifies the caller is a logged-in admin by checking the bearer token
// they send, using the same anon client Supabase would use in the browser.
async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: userData } = await anonClient.auth.getUser(token);
  if (!userData?.user) return null;

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("staff_profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile?.is_admin) return null;
  return userData.user;
}

export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: "Only an admin can create staff logins." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { email, password, fullName, department, isAdmin, permissions } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createError || !newUser?.user) {
      return NextResponse.json({ error: createError?.message || "Could not create login." }, { status: 400 });
    }

    const { error: profileError } = await admin.from("staff_profiles").insert({
      id: newUser.user.id,
      full_name: fullName,
      email,
      department: department || "other",
      is_admin: !!isAdmin,
      is_active: true
    });
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!isAdmin && permissions) {
      const rows = RESOURCES.map((resource) => ({
        staff_id: newUser.user.id,
        resource,
        can_create: !!permissions[resource]?.create,
        can_read: !!permissions[resource]?.read,
        can_update: !!permissions[resource]?.update,
        can_delete: !!permissions[resource]?.delete
      }));
      const { error: permError } = await admin.from("staff_permissions").insert(rows);
      if (permError) {
        return NextResponse.json({ error: permError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, userId: newUser.user.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}
