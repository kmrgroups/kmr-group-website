import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

// Deactivates a staff login rather than hard-deleting the auth user,
// so historical records (e.g. who created what) stay intact.
export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: "Only an admin can remove staff logins." }, { status: 403 });
  }

  try {
    const { staffId } = await req.json();
    if (!staffId) {
      return NextResponse.json({ error: "Missing staffId." }, { status: 400 });
    }
    if (staffId === caller.id) {
      return NextResponse.json({ error: "You can't deactivate your own account." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { error } = await admin.from("staff_profiles").update({ is_active: false }).eq("id", staffId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}
