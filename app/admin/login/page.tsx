"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/admin/dashboard");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 py-20 blueprint-bg">
      <form onSubmit={handleLogin} className="plate plate-dark bg-ink-2 text-warehouse p-8 w-full max-w-sm">
        <p className="eyebrow text-copper-light mb-2">Restricted Access</p>
        <h1 className="font-display text-3xl mb-6">Admin Login</h1>

        <label className="block text-sm mb-1 text-slate-light">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 bg-ink border border-white/15 px-3 py-2 text-sm focus:border-copper outline-none"
        />

        <label className="block text-sm mb-1 text-slate-light">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 bg-ink border border-white/15 px-3 py-2 text-sm focus:border-copper outline-none"
        />

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-copper hover:bg-copper-light transition-colors text-ink font-medium py-2.5"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <p className="text-xs text-slate mt-5 font-mono leading-relaxed">
          Admin users are created in Supabase → Authentication → Users, not on this page.
        </p>
      </form>
    </div>
  );
}
