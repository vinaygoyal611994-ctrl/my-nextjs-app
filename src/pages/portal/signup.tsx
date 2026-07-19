import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Wheat, Eye, EyeOff, UserPlus, ArrowLeft, Loader2, CheckCircle } from "lucide-react";

export default function PortalSignup() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name || !mobile || !password || !confirmPassword) {
      setError("सभी fields भरना जरूरी है।");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password और Confirm Password मेल नहीं खाते।");
      return;
    }

    if (password.length < 6) {
      setError("Password कम से कम 6 characters का होना चाहिए।");
      return;
    }

    if (mobile.replace(/\D/g, "").length < 10) {
      setError("सही mobile number डालें (कम से कम 10 digits)।");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/portal/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mobile: mobile.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Signup failed। कृपया फिर try करें।");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/portal/login");
      }, 2500);
    } catch {
      setError("Network error। Internet connection check करें।");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Register — Digital Viyapar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-amber-50 flex flex-col">
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
              <p className="text-gray-500 text-sm mt-1">Trader Registration (व्यापारी रजिस्टर)</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              {success ? (
                /* Success state */
                <div className="py-6 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={36} className="text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Account बन गया!</h2>
                  <p className="text-gray-500 text-sm mb-4">
                    आपका account सफलतापूर्वक बन गया है। अब Login करें।
                  </p>
                  <p className="text-xs text-gray-400">Login page पर redirect हो रहा है...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      पूरा नाम <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="आपका पूरा नाम"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                      maxLength={200}
                    />
                  </div>

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
                    <p className="text-xs text-gray-400 mt-1">
                      वही number जो आढ़तिया के पास registered है
                    </p>
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
                        placeholder="कम से कम 6 characters"
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

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Password दोबारा डालें"
                        className={`w-full px-4 py-3 pr-12 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all ${
                          confirmPassword && confirmPassword !== password
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="text-xs text-red-500 mt-1">Passwords मेल नहीं खाते</p>
                    )}
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
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3.5 rounded-xl transition-colors text-base"
                  >
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <UserPlus size={20} />
                    )}
                    {loading ? "Account बन रहा है..." : "Account बनाएं"}
                  </button>
                </form>
              )}

              {!success && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <p className="text-center text-sm text-gray-500">
                    पहले से account है?{" "}
                    <Link href="/portal/login" className="text-amber-600 hover:text-amber-700 font-semibold">
                      Login करें
                    </Link>
                  </p>
                </div>
              )}
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
