"use client";

import { signIn, getSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SupplierLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setLoading(false);
      setError("ইমেইল বা পাসওয়ার্ড ভুল।");
      return;
    }
    // Verify the session actually established and has the SUPPLIER role
    const session = await getSession();
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== "SUPPLIER") {
      setLoading(false);
      setError(
        "এই অ্যাকাউন্ট একটি Supplier অ্যাকাউন্ট নয়। Admin হলে /admin/login ব্যবহার করুন।"
      );
      return;
    }
    router.replace("/supplier");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white font-display text-xl mb-3">
            S
          </div>
          <p className="font-display text-2xl text-slate-900">Supplier Portal</p>
          <p className="text-sm text-slate-500 mt-1">Manza BD</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white border border-slate-200 rounded-2xl p-7 space-y-5 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
              placeholder="supplier@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white font-semibold py-3.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Supplier access only
        </p>
      </div>
    </div>
  );
}
