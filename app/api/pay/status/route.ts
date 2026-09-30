import { NextResponse } from "next/server";
import { razorpayStatus } from "@/lib/razorpay";

// For KMR Console › Payment settings: are the Razorpay keys set on this website? (No secrets are returned.)
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json(razorpayStatus()); }
