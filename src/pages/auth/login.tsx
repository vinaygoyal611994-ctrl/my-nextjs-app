import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Wheat, ArrowLeft, Eye, EyeOff, CheckCircle, LogIn } from "lucide-react";
import Link from "next/link";
import Head from "next/head";

const schema = z.object({
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

type FormData = z.infer<typeof schema>;

const highlights = [
  "Purchase & sale — auto double-entry",
  "Kisan & trader ledger, always live",
  "Daybook, reports in one click",
  "Trader portal — they check balance themselves",
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { mobile: data.mobile, password: data.password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Mobile number or password is incorrect.");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <>
      <Head>
        <title>Login — Digital Viyapar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen flex">

        {/* ── LEFT PANEL (brand) ── */}
        <div className="hidden lg:flex lg:w-[52%] bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl" />
          </div>
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

          {/* Top: Logo + back */}
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

          {/* Middle: Headline + features */}
          <div className="relative">
            <div className="inline-block bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide">
              MANDI ACCOUNTING SOFTWARE
            </div>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-3">
              Ab Bahi Khata Band,
              <span className="block bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                Digital Munim Shuru
              </span>
            </h2>
            <p className="text-gray-400 text-base mb-8 leading-relaxed">
              Complete mandi accounts — online, accurate, always available.
            </p>
            <ul className="space-y-3">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle size={11} className="text-green-400" />
                  </span>
                  <span className="text-gray-300 text-sm">{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom: Testimonial */}
          <div className="relative bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-gray-300 text-sm italic leading-relaxed mb-4">
              &quot;Pehle raat ko 2 baje tak register milate the. Ab Digital Viyapar se 9 baje ghar pahunch jaate hain.&quot;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0">RC</div>
              <div>
                <p className="text-white text-sm font-semibold">Ramesh Chand Agarwal</p>
                <p className="text-gray-500 text-xs">Aadhatiya, Sikar Mandi</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL (form) ── */}
        <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-12 sm:px-12">
          {/* Mobile logo */}
          <div className="lg:hidden w-full max-w-sm mb-8">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center shadow">
                <Wheat size={20} className="text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">Digital Viyapar</span>
            </Link>
          </div>

          <div className="w-full max-w-sm">
            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome back</h1>
              <p className="text-gray-500 text-sm">Login to your mandi account</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Mobile */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  {...register("mobile")}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                />
                {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile.message}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-gray-700">Password</label>
                  <Link href="/auth/forgot-password" className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Enter your password"
                    {...register("password")}
                    className="w-full px-4 py-3 pr-11 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" tabIndex={-1}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  <span className="shrink-0 mt-0.5">⚠️</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-300 text-gray-950 font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 hover:-translate-y-0.5"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
                {loading ? "Logging in..." : "Login to Mandi"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">New to Digital Viyapar?</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <Link href="/auth/register">
              <button className="w-full border-2 border-gray-200 hover:border-amber-400 text-gray-700 hover:text-amber-700 font-semibold py-3.5 rounded-xl transition-all text-sm">
                Register Your Mandi — It&apos;s Free
              </button>
            </Link>

            <p className="text-center text-xs text-gray-400 mt-8">
              Are you a trader?{" "}
              <Link href="/portal/login" className="text-blue-500 hover:text-blue-600 font-medium">
                Trader Portal Login →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
