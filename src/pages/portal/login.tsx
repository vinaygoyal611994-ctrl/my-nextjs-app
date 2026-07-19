import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Wheat, Eye, EyeOff, LogIn, ArrowLeft, Loader2 } from "lucide-react";

export default function PortalLogin() {
  const router = useRouter();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!mobile || !password) {
      setError("सभी fields भरना जरूरी है।");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: mobile.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Login failed। कृपया फिर try करें।");
        return;
      }

      router.push("/portal/dashboard");
    } catch {
      setError("Network error। Internet connection check करें।");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Login — Digital Viyapar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-green-50 flex flex-col">
        {/* Top bar */}
        <div className="p-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-700 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Digital Viyapar
          </Link>
        </div>

        {/* Card */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Wheat size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Digital Viyapar</h1>
              <p className="text-gray-500 text-sm mt-1">Trader Login (व्यापारी Login)</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Mobile */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10 digit mobile number"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                    maxLength={15}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="अपना password डालें"
                      className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-bold py-3.5 rounded-xl transition-colors text-base"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <LogIn size={20} />
                  )}
                  {loading ? "Login हो रहा है..." : "Login करें"}
                </button>
              </form>

              {/* Links */}
              <div className="mt-6 pt-5 border-t border-gray-100 space-y-3">
                <p className="text-center text-sm text-gray-500">
                  Account नहीं है?{" "}
                  <Link href="/portal/signup" className="text-amber-600 hover:text-amber-700 font-semibold">
                    Register करें
                  </Link>
                </p>
                <p className="text-center text-sm text-gray-400">
                  <Link href="/portal/forgot-password" className="hover:text-gray-600">
                    Password भूल गए?
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4 text-xs text-gray-400">
          © 2025 Digital Viyapar
        </div>
      </div>
    </>
  );
}
