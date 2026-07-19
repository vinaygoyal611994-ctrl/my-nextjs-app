import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Wheat, ShoppingCart, Store, BookOpen, CreditCard, Smartphone,
  CheckCircle, ArrowRight, LogIn, UserPlus, TrendingUp, Users,
  BarChart2, FileText, Building2, Landmark, Coins, Menu, X,
  Star, Shield, Zap, Globe, ChevronRight, Receipt, BadgeCheck, LayoutDashboard,
} from "lucide-react";

// ─── DATA ────────────────────────────────────────────────────────────────────

const features = [
  { icon: ShoppingCart, title: "Purchase Entry", hindi: "खरीद दर्ज करें", desc: "Record every kisan's crop with bags, weight, rate, commission, and deductions — in seconds.", color: "amber" },
  { icon: Store,        title: "Sale & Billing", hindi: "बिक्री और बिल", desc: "Create trader bills with mandi shulk, KKF, hammali, GST — fully auto-calculated.", color: "blue" },
  { icon: BookOpen,     title: "Party Ledger",   hindi: "खाता-बही",     desc: "Kisan and vyapari ledgers with live outstanding balance — always accurate.", color: "green" },
  { icon: FileText,     title: "Daybook",        hindi: "रोजनामचा",     desc: "Complete journal of every entry by date — purchases, sales, payments.", color: "purple" },
  { icon: CreditCard,   title: "Jama-Naama",     hindi: "जमा-नामा",     desc: "Receipt and payment entries — cash, bank, UPI, cheque — all modes supported.", color: "teal" },
  { icon: Coins,        title: "Advance / Uchanti", hindi: "उछंती",     desc: "Give advances to kisan with byaj calculation and auto-recovery on purchase.", color: "orange" },
  { icon: Landmark,     title: "Govt Dues",      hindi: "सरकारी देय",   desc: "Track mandi shulk, KKF, committee dues — never miss a payment.", color: "red" },
  { icon: BarChart2,    title: "Reports",        hindi: "हिसाब-किताब",  desc: "Outstanding, P&L, trial balance, party-wise — all reports in one click.", color: "indigo" },
  { icon: Smartphone,   title: "Trader Portal",  hindi: "व्यापारी पोर्टल", desc: "Traders check their own balance and bills online — no more phone calls to you.", color: "rose" },
];

const colorMap: Record<string, string> = {
  amber:  "bg-amber-50 text-amber-600 border-amber-100",
  blue:   "bg-blue-50 text-blue-600 border-blue-100",
  green:  "bg-green-50 text-green-600 border-green-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
  teal:   "bg-teal-50 text-teal-600 border-teal-100",
  orange: "bg-orange-50 text-orange-600 border-orange-100",
  red:    "bg-red-50 text-red-600 border-red-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  rose:   "bg-rose-50 text-rose-600 border-rose-100",
};

const benefits = [
  { before: "Raat ko baithe register milao", after: "Ledger auto-balances every entry", icon: "📒" },
  { before: "Trader ka call aaye to balance dhundho", after: "Trader khud portal se check kare", icon: "📱" },
  { before: "Galti dhundna mushkil — corrections risky", after: "Cancel & correct any entry anytime", icon: "✅" },
  { before: "Year-end closing = weeks of work", after: "Reports ready in one click, anytime", icon: "📊" },
];

const steps = [
  { n: "01", title: "Register Your Mandi", desc: "Create your firm in 2 minutes — mandi name, address, mobile. Done.", icon: Building2, color: "from-amber-400 to-amber-600" },
  { n: "02", title: "Add Parties & Items",  desc: "Add your kisan, traders, jins (grains). Set opening balances.", icon: Users, color: "from-green-400 to-green-600" },
  { n: "03", title: "Start Recording",      desc: "Enter purchases, sales, payments. Everything auto-posts to ledger.", icon: FileText, color: "from-blue-400 to-blue-600" },
  { n: "04", title: "Share Trader Portal",  desc: "Give your traders access — they check their own balance online.", icon: Globe, color: "from-purple-400 to-purple-600" },
];

const testimonials = [
  {
    name: "Ramesh Chand Agarwal",
    role: "Aadhatiya, Sikar Mandi",
    text: "Pehle raat ko 2 baje tak register milate the. Ab Digital Viyapar se 9 baje ghar pahunch jaate hain. Kisan ka hisaab, vyapari ka bill — sab ek jagah.",
    stars: 5,
    initials: "RA",
    color: "bg-amber-500",
  },
  {
    name: "Suresh Kumar Sharma",
    role: "Malik, Khairthal Anaj Mandi",
    text: "Trader portal ka idea bahut achha laga. Ab vyapari khud apna balance check karte hain — hamare calls 80% kam ho gaye. Bahut time bachat hui.",
    stars: 5,
    initials: "SK",
    color: "bg-green-600",
  },
  {
    name: "Mohan Lal Gupta",
    role: "Munim, Alwar Mandi",
    text: "Advance (uchanti) tracking aur byaj ka automatic calculation — iska bahut fayda hua. Pehle manually calculate karte the, ab system sab karta hai.",
    stars: 5,
    initials: "MG",
    color: "bg-blue-600",
  },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    desc: "Get started with no commitment.",
    highlight: false,
    features: ["1 Mandi / Firm", "Up to 100 parties", "Purchase & Sale", "Ledger & Daybook", "Basic Reports", "Trader Portal"],
    cta: "Start Free",
    href: "/auth/register",
  },
  {
    name: "Professional",
    price: "₹499",
    period: "/month",
    desc: "For active mandis with growing needs.",
    highlight: true,
    badge: "Most Popular",
    features: ["Everything in Starter", "Unlimited parties", "Multi-user (malik + munim)", "Advance management", "Hammali & payroll", "Govt dues tracking", "Bank reconciliation", "Priority support", "Excel / PDF export"],
    cta: "Start Free Trial",
    href: "/auth/register",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "Multi-branch or large operations.",
    highlight: false,
    features: ["Everything in Pro", "Multiple branches", "Custom accounts", "API access", "Dedicated onboarding", "Custom reports", "Phone support"],
    cta: "Contact Us",
    href: "/about",
  },
];

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "/about" },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Navbar() {
  const [open, setOpen] = useState(false);
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session;

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center shadow">
            <Wheat size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Digital Viyapar</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} className="text-sm font-medium text-gray-600 hover:text-amber-600 transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? (
            <Link href="/dashboard">
              <button className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md">
                <LayoutDashboard size={15} /> Go to Dashboard
              </button>
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm font-semibold text-gray-700 hover:text-amber-600 transition-colors px-3 py-2">
                Login
              </Link>
              <Link href="/auth/register">
                <button className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md">
                  <UserPlus size={15} /> Start Free
                </button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-gray-600 hover:text-gray-900 p-1">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)}
              className="block text-sm font-medium text-gray-700 hover:text-amber-600 py-2.5 border-b border-gray-50">
              {l.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            {isLoggedIn ? (
              <Link href="/dashboard" onClick={() => setOpen(false)}
                className="block text-center bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-amber-700">
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setOpen(false)}
                  className="block text-center border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-gray-50">
                  Login
                </Link>
                <Link href="/auth/register" onClick={() => setOpen(false)}
                  className="block text-center bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-amber-700">
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center">
                <Wheat size={18} className="text-white" />
              </div>
              <span className="text-white font-bold text-lg">Digital Viyapar</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Complete mandi accounting for grain markets across India. Ab bahi khata band, Digital Munim shuru.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#features" className="hover:text-amber-400 transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-amber-400 transition-colors">Pricing</a></li>
              <li><a href="#how-it-works" className="hover:text-amber-400 transition-colors">How it Works</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/about" className="hover:text-amber-400 transition-colors">About Us</Link></li>
              <li><Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-amber-400 transition-colors">Terms & Conditions</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Account</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/auth/register" className="hover:text-amber-400 transition-colors">Register Mandi</Link></li>
              <li><Link href="/auth/login" className="hover:text-amber-400 transition-colors">Mandi Login</Link></li>
              <li><Link href="/portal/login" className="hover:text-blue-400 transition-colors">Trader Portal</Link></li>
              <li><Link href="/portal/signup" className="hover:text-blue-400 transition-colors">Trader Register</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <p>© 2025 Digital Viyapar. All rights reserved.</p>
          <p>Grain Market Accounting Software — Made for India 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session;

  return (
    <>
      <Head>
        <title>Digital Viyapar — Ab Bahi Khata Band, Digital Munim Shuru</title>
        <meta name="description" content="Complete digital accounting for anaj mandis — purchase, sale, party ledger, daybook, reports, and trader portal. Register free today." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-white font-sans antialiased">
        <Navbar />

        {/* ── HERO ── */}
        <section className="relative overflow-hidden bg-gray-950 pt-20 pb-32">
          {/* Background glow */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-green-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-3xl" />
          </div>

          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wide">
              <Zap size={12} className="fill-amber-400" />
              INDIA'S MANDI ACCOUNTING SOFTWARE
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-tight mb-4 tracking-tight">
              Ab Bahi Khata Band,
              <span className="block bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                Digital Munim Shuru
              </span>
            </h1>

            <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              Complete mandi accounting — purchase, sale, party ledger, daybook, and reports —
              all in one place. <span className="text-gray-300">Online. Always accurate.</span>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              {isLoggedIn ? (
                <Link href="/dashboard">
                  <button className="group flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-400/40 hover:-translate-y-0.5">
                    <LayoutDashboard size={18} />
                    Go to Dashboard
                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </Link>
              ) : (
                <>
                  <Link href="/auth/register">
                    <button className="group flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-400/40 hover:-translate-y-0.5">
                      <UserPlus size={18} />
                      Start Free — Register Your Mandi
                      <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </Link>
                  <Link href="/auth/login">
                    <button className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all">
                      <LogIn size={18} />
                      Login to Your Mandi
                    </button>
                  </Link>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="inline-grid grid-cols-3 gap-px bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {[
                { val: "100%", label: "Double-entry accurate" },
                { val: "9+", label: "Core modules" },
                { val: "Free", label: "To get started" },
              ].map((s) => (
                <div key={s.label} className="bg-gray-900/60 px-8 py-5 text-center">
                  <div className="text-2xl font-bold text-white mb-0.5">{s.val}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PROBLEM → SOLUTION STRIP ── */}
        <section className="bg-amber-50 border-y border-amber-100 py-5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-2 text-sm font-medium text-amber-900">
              {["No more paper registers", "No more calculation errors", "No more late-night reconciliation", "Traders check balance themselves"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-amber-600 shrink-0" /> {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="inline-block bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">Features</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Everything Your Mandi Needs</h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                From the first purchase entry to year-end closing — Digital Viyapar handles it all.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f) => {
                const Icon = f.icon;
                const cls = colorMap[f.color];
                return (
                  <div key={f.title} className="group bg-white rounded-2xl border border-gray-100 p-6 hover:border-gray-200 hover:shadow-lg transition-all duration-200 cursor-default">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${cls}`}>
                      <Icon size={22} />
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <h3 className="text-base font-bold text-gray-900">{f.title}</h3>
                      <span className="text-xs text-gray-400">{f.hindi}</span>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── BENEFITS ── */}
        <section className="py-24 bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="inline-block bg-green-500/10 text-green-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">Benefits</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Before vs After Digital Viyapar</h2>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">See the real difference it makes in your daily mandi work.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {benefits.map((b) => (
                <div key={b.before} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <div className="text-3xl mb-4">{b.icon}</div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mt-0.5">
                        <X size={10} className="text-red-400" />
                      </span>
                      <p className="text-gray-400 text-sm">{b.before}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mt-0.5">
                        <CheckCircle size={10} className="text-green-400" />
                      </span>
                      <p className="text-white text-sm font-medium">{b.after}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">How it Works</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Start in 4 Simple Steps</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">Get your mandi running digitally in under 10 minutes.</p>
            </div>
            <div className="relative">
              {/* Connector line (desktop) */}
              <div className="hidden lg:block absolute top-16 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-amber-200 via-green-200 to-purple-200" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {steps.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.n} className="flex flex-col items-center text-center">
                      <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-5 shadow-lg z-10`}>
                        <Icon size={28} className="text-white" />
                        <span className="absolute -top-2 -right-2 w-6 h-6 bg-white border-2 border-gray-200 rounded-full text-xs font-bold text-gray-700 flex items-center justify-center">
                          {s.n.replace("0", "")}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 mb-2">{s.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-center mt-14">
              {isLoggedIn ? (
                <Link href="/dashboard">
                  <button className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                    <LayoutDashboard size={18} /> Go to Dashboard
                    <ArrowRight size={16} />
                  </button>
                </Link>
              ) : (
                <Link href="/auth/register">
                  <button className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                    <UserPlus size={18} /> Get Started Now — It&apos;s Free
                    <ArrowRight size={16} />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section className="py-24 bg-amber-50 border-y border-amber-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="inline-block bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">Testimonials</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Mandi Maalik Kya Kehte Hain?</h2>
              <p className="text-gray-500 text-lg">Real feedback from aadhatiya who switched to Digital Viyapar.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <div key={t.name} className="bg-white rounded-2xl border border-amber-100 p-7 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 mb-4">
                    {Array(t.stars).fill(0).map((_, i) => (
                      <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-6 italic">&quot;{t.text}&quot;</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="inline-block bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">Pricing</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Simple, Honest Pricing</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">Start free. Upgrade as your mandi grows. No hidden charges.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {plans.map((plan) => (
                <div key={plan.name} className={`relative rounded-2xl flex flex-col overflow-hidden ${
                  plan.highlight
                    ? "bg-gray-950 text-white shadow-2xl ring-2 ring-amber-500 scale-105"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}>
                  {"badge" in plan && plan.badge && (
                    <div className="bg-amber-500 text-gray-950 text-xs font-bold text-center py-1.5 tracking-widest uppercase">
                      {plan.badge}
                    </div>
                  )}
                  <div className="p-8 flex-1 flex flex-col">
                    <h3 className={`text-lg font-bold mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.name}</h3>
                    <p className={`text-sm mb-5 ${plan.highlight ? "text-gray-400" : "text-gray-500"}`}>{plan.desc}</p>
                    <div className="flex items-end gap-1 mb-7">
                      <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.price}</span>
                      {plan.period && <span className={`mb-1 text-sm ${plan.highlight ? "text-gray-400" : "text-gray-500"}`}>{plan.period}</span>}
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <CheckCircle size={15} className={`shrink-0 mt-0.5 ${plan.highlight ? "text-amber-400" : "text-green-500"}`} />
                          <span className={`text-sm ${plan.highlight ? "text-gray-300" : "text-gray-600"}`}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href={plan.href}>
                      <button className={`w-full font-bold py-3.5 rounded-xl transition-all text-sm ${
                        plan.highlight
                          ? "bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-lg shadow-amber-500/20"
                          : "border-2 border-gray-300 text-gray-700 hover:border-amber-500 hover:text-amber-600"
                      }`}>
                        {plan.cta}
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TRUST STRIP ── */}
        <section className="py-16 bg-gray-50 border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              {[
                { icon: Shield,    title: "Secure & Private", desc: "Your data is yours. bcrypt passwords, firm-isolated data, no sharing.", color: "text-green-600 bg-green-100" },
                { icon: Zap,       title: "Real-time Ledger", desc: "Every entry instantly updates balances — no manual posting ever.", color: "text-amber-600 bg-amber-100" },
                { icon: BadgeCheck,title: "Double-entry Accurate", desc: "Full double-entry accounting — every debit has a matching credit.", color: "text-blue-600 bg-blue-100" },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.title} className="flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${t.color}`}>
                      <Icon size={26} />
                    </div>
                    <h4 className="text-base font-bold text-gray-900 mb-1.5">{t.title}</h4>
                    <p className="text-gray-500 text-sm max-w-xs">{t.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="py-28 bg-gray-950 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
              Ready to Digitize <br />
              <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                Your Mandi?
              </span>
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              Register in 2 minutes. Start recording entries today. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isLoggedIn ? (
                <Link href="/dashboard">
                  <button className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold px-10 py-4 rounded-2xl text-base transition-all shadow-lg shadow-amber-500/20 hover:-translate-y-0.5">
                    <LayoutDashboard size={18} />
                    Go to Dashboard
                  </button>
                </Link>
              ) : (
                <>
                  <Link href="/auth/register">
                    <button className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold px-10 py-4 rounded-2xl text-base transition-all shadow-lg shadow-amber-500/20 hover:-translate-y-0.5">
                      <UserPlus size={18} />
                      Start Free — Register Now
                    </button>
                  </Link>
                  <Link href="/auth/login">
                    <button className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold px-10 py-4 rounded-2xl text-base transition-all">
                      <LogIn size={18} /> Login
                    </button>
                  </Link>
                </>
              )}
            </div>
            <p className="text-gray-600 text-sm mt-8">
              Are you a trader?{" "}
              <Link href="/portal/login" className="text-blue-400 hover:text-blue-300 underline">
                Trader Portal Login →
              </Link>
            </p>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
