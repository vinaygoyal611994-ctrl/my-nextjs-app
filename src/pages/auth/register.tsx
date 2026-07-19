import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  Wheat, Eye, EyeOff, Loader2, CheckCircle,
  Building2, User, Phone, Lock, ArrowLeft, MapPin, Zap,
} from "lucide-react";

const perks = [
  { icon: "⚡", title: "Up in 2 minutes", desc: "Create your firm and start entering records immediately." },
  { icon: "📒", title: "Complete accounting", desc: "Purchase, sale, ledger, daybook — everything auto-posts." },
  { icon: "📱", title: "Trader portal free", desc: "Your traders check their own balance online — no calls." },
  { icon: "🔒", title: "Secure & private", desc: "Your data is isolated to your firm only." },
];

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({ firmName: "", address: "", adminName: "", mobile: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.firmName || !form.address || !form.adminName || !form.mobile || !form.password || !form.confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.mobile.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmName: form.firmName.trim(),
          address: form.address.trim(),
          adminName: form.adminName.trim(),
          mobile: form.mobile.trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Registration failed. Please try again."); return; }
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 2800);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Register Your Mandi — Digital Viyapar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen flex">

        {/* ── LEFT PANEL (brand) ── */}
        <div className="hidden lg:flex lg:w-[45%] bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-green-500/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
          </div>
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

          {/* Logo + back */}
          <div className="relative flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center shadow-lg">
                <Wheat size={22} className="text-white" />
              </div>
              <span className="text-xl font-bold text-white">Digital Viyapar</span>
            </Link>
            <Link href="/" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors">
              <ArrowLeft size={14} /> Home
            </Link>
          </div>

          {/* Headline */}
          <div className="relative">
            <div className="inline-block bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 tracking-wide">
              FREE TO START
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight mb-3">
              Apni Mandi Ko
              <span className="block bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                Digital Karo Aaj Hi
              </span>
            </h2>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              Register in 2 minutes and start recording your first purchase entry today.
            </p>
            <div className="grid grid-cols-1 gap-4">
              {perks.map((p) => (
                <div key={p.title} className="flex items-start gap-3 bg-white/5 border border-white/8 rounded-xl p-4">
                  <span className="text-xl shrink-0">{p.icon}</span>
                  <div>
                    <p className="text-white text-sm font-semibold mb-0.5">{p.title}</p>
                    <p className="text-gray-500 text-xs leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom badge */}
          <div className="relative flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <Zap size={18} className="text-amber-400 shrink-0" />
            <p className="text-amber-300 text-sm">
              <span className="font-bold">100% free</span> to register. No credit card required.
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL (form) ── */}
        <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-10 sm:px-10 overflow-y-auto">
          {/* Mobile logo */}
          <div className="lg:hidden w-full max-w-lg mb-6">
            <Link href="/" className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center shadow">
                <Wheat size={20} className="text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">Digital Viyapar</span>
            </Link>
          </div>

          <div className="w-full max-w-lg">
            {success ? (
              /* Success State */
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={40} className="text-green-500" />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Mandi Registered!</h2>
                <p className="text-gray-500 mb-1">Your mandi account has been created successfully.</p>
                <p className="text-sm text-gray-400">Redirecting to login page...</p>
                <div className="mt-8">
                  <Link href="/auth/login">
                    <button className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold px-8 py-3 rounded-xl text-sm transition-all">
                      Go to Login →
                    </button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Heading */}
                <div className="mb-8">
                  <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Register Your Mandi</h1>
                  <p className="text-gray-500 text-sm">Fill in the details below to create your digital mandi account.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Section: Mandi Details */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <Building2 size={13} />
                      <span>Mandi / Firm Details</span>
                      <div className="flex-1 h-px bg-gray-100 ml-1" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Mandi / Firm Name <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={form.firmName}
                            onChange={(e) => set("firmName", e.target.value)}
                            placeholder="e.g. श्री राम आढ़त, खैरथल"
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                            maxLength={200}
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Address / Location <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={form.address}
                            onChange={(e) => set("address", e.target.value)}
                            placeholder="e.g. Grain Market, Khairthal, Alwar"
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                            maxLength={500}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Admin Details */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <User size={13} />
                      <span>Your (Admin) Details</span>
                      <div className="flex-1 h-px bg-gray-100 ml-1" />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Your Name (मालिक / मुनीम) <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={form.adminName}
                          onChange={(e) => set("adminName", e.target.value)}
                          placeholder="Your full name"
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                          maxLength={200}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Mobile Number <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="tel"
                          value={form.mobile}
                          onChange={(e) => set("mobile", e.target.value)}
                          placeholder="10-digit mobile number"
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                          maxLength={15}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 ml-1">This will be your login ID</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Password <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => set("password", e.target.value)}
                            placeholder="Min. 6 characters"
                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Confirm Password <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showConfirm ? "text" : "password"}
                            value={form.confirmPassword}
                            onChange={(e) => set("confirmPassword", e.target.value)}
                            placeholder="Re-enter password"
                            className={`w-full pl-10 pr-10 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all ${
                              form.confirmPassword && form.confirmPassword !== form.password
                                ? "border-red-300 bg-red-50 focus:bg-red-50"
                                : "border-gray-200 bg-gray-50 focus:bg-white"
                            }`}
                          />
                          <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        {form.confirmPassword && form.confirmPassword !== form.password && (
                          <p className="text-xs text-red-500 mt-1 ml-1">Passwords do not match</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                      <span className="shrink-0 mt-0.5">⚠️</span> {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-300 text-gray-950 font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 mt-2"
                  >
                    {loading ? <Loader2 size={17} className="animate-spin" /> : <Wheat size={17} />}
                    {loading ? "Creating your mandi..." : "Register Mandi — Start Free"}
                  </button>

                  <p className="text-center text-sm text-gray-500">
                    Already registered?{" "}
                    <Link href="/auth/login" className="text-amber-600 hover:text-amber-700 font-semibold">
                      Login here
                    </Link>
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
