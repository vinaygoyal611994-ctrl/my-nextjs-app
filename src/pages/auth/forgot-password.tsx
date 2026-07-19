import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  Wheat, ArrowLeft, Phone, Loader2, CheckCircle,
  KeyRound, ShieldCheck, LogIn, Copy, Check,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const digits = mobile.replace(/\D/g, "");
    if (digits.length < 10) { setError("Enter a valid 10-digit mobile number."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Something went wrong."); return; }
      // If tempPassword returned, mobile was found and reset
      setTempPassword(data.tempPassword ?? "");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function copyPassword() {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Head>
        <title>Forgot Password — Digital Viyapar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen flex">

        {/* ── LEFT PANEL ── */}
        <div className="hidden lg:flex lg:w-[45%] bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 right-0 w-80 h-80 bg-green-500/10 rounded-full blur-3xl" />
          </div>
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

          {/* Logo */}
          <div className="relative flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center shadow-lg">
                <Wheat size={22} className="text-white" />
              </div>
              <span className="text-xl font-bold text-white">Digital Viyapar</span>
            </Link>
            <Link href="/auth/login" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors">
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>

          {/* Middle content */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
              <KeyRound size={30} className="text-amber-400" />
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-3">
              Password Reset
              <span className="block bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                Quick & Simple
              </span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Enter your registered mobile number and we'll generate a temporary password for you instantly.
            </p>
            <div className="space-y-4">
              {[
                { icon: ShieldCheck, text: "Enter your registered mobile number" },
                { icon: KeyRound,    text: "Get your temporary password instantly" },
                { icon: LogIn,       text: "Login and set a new password" },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-amber-400" />
                    </div>
                    <p className="text-gray-300 text-sm">{step.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom note */}
          <div className="relative bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-gray-500 text-xs leading-relaxed">
              <span className="text-gray-300 font-medium">Note:</span> After logging in with the temporary password, please update your password from Settings for security.
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL (form) ── */}
        <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-12 sm:px-12">
          {/* Mobile logo */}
          <div className="lg:hidden w-full max-w-sm mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center shadow">
                <Wheat size={20} className="text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">Digital Viyapar</span>
            </Link>
          </div>

          <div className="w-full max-w-sm">
            {!tempPassword ? (
              <>
                {/* Back link (mobile) */}
                <Link href="/auth/login" className="lg:hidden inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-600 mb-6 transition-colors">
                  <ArrowLeft size={14} /> Back to Login
                </Link>

                {/* Heading */}
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                    <KeyRound size={22} className="text-amber-500" />
                  </div>
                  <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Forgot Password?</h1>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    No worries. Enter your registered mobile number and we'll reset your password instantly.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Registered Mobile Number
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="9876543210"
                        maxLength={15}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-1">
                      The mobile number you used to register your mandi
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                      <span className="shrink-0 mt-0.5">⚠️</span> {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-300 text-gray-950 font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-amber-500/20 hover:-translate-y-0.5"
                  >
                    {loading ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
                    {loading ? "Resetting..." : "Reset My Password"}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <Link href="/auth/login" className="text-sm text-gray-500 hover:text-amber-600 transition-colors">
                    ← Back to Login
                  </Link>
                </div>
              </>
            ) : (
              /* ── SUCCESS STATE ── */
              <div>
                <div className="w-14 h-14 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle size={30} className="text-green-500" />
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Password Reset!</h1>
                <p className="text-gray-500 text-sm mb-8">
                  Your temporary password has been generated. Use it to login, then update your password from Settings.
                </p>

                {/* Temp password display */}
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-6">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Your Temporary Password</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xl font-extrabold text-gray-900 tracking-widest">{tempPassword}</span>
                    <button
                      onClick={copyPassword}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-bold px-3 py-2 rounded-lg transition-all shrink-0"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-sm text-blue-700">
                  <p className="font-semibold mb-1">⚠️ Important</p>
                  <p className="text-xs leading-relaxed">Please change your password after logging in. Go to Settings → Change Password.</p>
                </div>

                <Link href="/auth/login">
                  <button className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-amber-500/20">
                    <LogIn size={17} /> Login Now
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
