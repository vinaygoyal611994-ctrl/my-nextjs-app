import Head from "next/head";
import Link from "next/link";
import {
  Wheat,
  ShoppingCart,
  Users,
  Store,
  BookOpen,
  CreditCard,
  Smartphone,
  CheckCircle,
  ArrowRight,
  LogIn,
  UserPlus,
  TrendingUp,
  Tractor,
} from "lucide-react";

const features = [
  {
    icon: ShoppingCart,
    title: "खरीद-बिक्री ट्रैकिंग",
    desc: "हर खरीद और बिक्री का पूरा record एक click में देखें।",
    color: "bg-amber-100 text-amber-600",
  },
  {
    icon: Tractor,
    title: "किसान खाता",
    desc: "अपनी फसल की खरीद का हिसाब, आढ़त, और बकाया देखें।",
    color: "bg-green-100 text-green-600",
  },
  {
    icon: Store,
    title: "व्यापारी खाता",
    desc: "माल खरीदने का पूरा हिसाब और बिल की details।",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: BookOpen,
    title: "रोजनामचा",
    desc: "दिन-by-दिन का पूरा लेनदेन एक जगह।",
    color: "bg-purple-100 text-purple-600",
  },
  {
    icon: CreditCard,
    title: "Payment History",
    desc: "कब और कितना पैसा मिला या दिया, सब कुछ देखें।",
    color: "bg-teal-100 text-teal-600",
  },
  {
    icon: Smartphone,
    title: "Online Balance Check",
    desc: "कभी भी, कहीं भी अपना बकाया balance check करें।",
    color: "bg-rose-100 text-rose-600",
  },
];

const steps = [
  {
    number: "1",
    title: "आढ़तिया entry करता है",
    desc: "आपके आढ़तिया Digital Viyapar पर आपकी खरीद, बिक्री और payment entries डालते हैं।",
    color: "bg-amber-500",
  },
  {
    number: "2",
    title: "आप Login करें",
    desc: "अपना Firm ID और mobile number से account बनाएं और login करें।",
    color: "bg-green-500",
  },
  {
    number: "3",
    title: "अपना हिसाब देखें",
    desc: "अपना पूरा हिसाब, बकाया balance, और transactions देखें — कभी भी, कहीं भी।",
    color: "bg-blue-500",
  },
];

export default function DigitalViyaparLanding() {
  return (
    <>
      <Head>
        <title>Digital Viyapar — मंडी का डिजिटल हिसाब</title>
        <meta
          name="description"
          content="किसान और व्यापारी का पूरा हिसाब एक जगह। Digital Viyapar पर अपना account बनाएं और अपना मंडी हिसाब देखें।"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-white font-sans">
        {/* ── Navbar ── */}
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            <Link href="/digital-viyapar" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center shadow-md">
                <Wheat size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">
                Digital Viyapar
              </span>
            </Link>
            <Link href="/portal/login">
              <button className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors shadow-sm">
                <LogIn size={15} />
                Login करें
              </button>
            </Link>
          </div>
        </nav>

        {/* ── Hero Section ── */}
        <section className="relative overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-amber-400 to-green-500" />
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-green-400/20 blur-3xl" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Wheat size={14} />
              मंडी का डिजिटल हिसाब
            </div>

            {/* Main heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-5 leading-tight">
              Digital Viyapar
            </h1>

            {/* Hindi tagline */}
            <p className="text-2xl sm:text-3xl font-semibold text-white/95 mb-3">
              मंडी का हिसाब, डिजिटल तरीके से
            </p>
            <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              किसान और व्यापारी का पूरा हिसाब एक जगह
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/portal/login">
                <button className="flex items-center justify-center gap-2 bg-white text-amber-700 font-bold px-8 py-4 rounded-xl text-lg shadow-xl hover:shadow-2xl hover:bg-amber-50 transition-all duration-200 w-full sm:w-auto">
                  <LogIn size={20} />
                  Login करें
                </button>
              </Link>
              <Link href="/portal/signup">
                <button className="flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm border-2 border-white text-white font-bold px-8 py-4 rounded-xl text-lg hover:bg-white/25 transition-all duration-200 w-full sm:w-auto">
                  <UserPlus size={20} />
                  Register करें
                </button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
              {[
                { val: "100%", label: "Secure" },
                { val: "24/7", label: "Available" },
                { val: "Free", label: "For Parties" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl font-bold text-white">{s.val}</div>
                  <div className="text-sm text-white/70 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Section ── */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <span className="text-amber-600 font-semibold text-sm uppercase tracking-wider">Features</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
                सब कुछ एक जगह
              </h2>
              <p className="text-gray-500 mt-3 text-lg max-w-xl mx-auto">
                Digital Viyapar पर वो सब मिलता है जो एक किसान या व्यापारी को चाहिए
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                      <Icon size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <span className="text-green-600 font-semibold text-sm uppercase tracking-wider">How It Works</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
                कैसे काम करता है?
              </h2>
              <p className="text-gray-500 mt-3 text-lg">
                सिर्फ 3 आसान steps में अपना हिसाब देखें
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connecting line (desktop only) */}
              <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-amber-300 via-green-300 to-blue-300 z-0" />

              {steps.map((step, idx) => (
                <div key={idx} className="relative z-10 text-center">
                  <div className={`w-20 h-20 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg`}>
                    <span className="text-3xl font-bold text-white">{step.number}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Party Section: Kisan vs Vyapari ── */}
        <section className="py-20 bg-gradient-to-br from-gray-50 to-amber-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <span className="text-amber-600 font-semibold text-sm uppercase tracking-wider">For Everyone</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
                आपको क्या दिखेगा?
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Kisan column */}
              <div className="bg-white rounded-2xl border border-green-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Tractor size={22} className="text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">किसान को क्या दिखेगा</h3>
                  </div>
                  <p className="text-green-100 text-sm">Farmers — अपनी फसल का हिसाब</p>
                </div>
                <ul className="p-6 space-y-4">
                  {[
                    "फसल की हर खरीद का detail — date, bags, rate",
                    "आढ़त, katuti और net amount",
                    "Total बकाया balance (मिलना है या देना है)",
                    "Payment history — कब और कितना मिला",
                    "Advance (उछंती) का हिसाब",
                    "Village और contact details",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle size={18} className="text-green-500 mt-0.5 shrink-0" />
                      <span className="text-gray-700 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Vyapari column */}
              <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Store size={22} className="text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">व्यापारी को क्या दिखेगा</h3>
                  </div>
                  <p className="text-blue-100 text-sm">Traders — अपने माल का हिसाब</p>
                </div>
                <ul className="p-6 space-y-4">
                  {[
                    "हर Sale bill का detail — माल, quantity, rate",
                    "Total payable amount और due date",
                    "Outstanding balance (कितना देना है)",
                    "Payment history — कब और कितना दिया",
                    "GSTIN और bill-wise tracking",
                    "सभी transactions की complete list",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle size={18} className="text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-gray-700 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust Section ── */}
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                {
                  icon: TrendingUp,
                  title: "Real-time Data",
                  desc: "आढ़तिया entry करते ही आपको दिख जाता है",
                  color: "text-amber-600 bg-amber-100",
                },
                {
                  icon: Users,
                  title: "Secure Access",
                  desc: "सिर्फ आप अपना हिसाब देख सकते हैं",
                  color: "text-green-600 bg-green-100",
                },
                {
                  icon: Smartphone,
                  title: "Mobile Friendly",
                  desc: "कोई भी phone पर आसानी से use करें",
                  color: "text-blue-600 bg-blue-100",
                },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.title} className="flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${t.color}`}>
                      <Icon size={28} />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{t.title}</h4>
                    <p className="text-gray-500 text-sm">{t.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Footer CTA ── */}
        <section className="py-20 bg-gradient-to-br from-amber-500 to-green-600 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              आज ही शुरू करें
            </h2>
            <p className="text-white/80 text-lg mb-10 max-w-xl mx-auto">
              अपने आढ़तिया का Firm ID लेकर account बनाएं और अभी से अपना हिसाब देखना शुरू करें — बिल्कुल मुफ्त।
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/portal/signup">
                <button className="flex items-center justify-center gap-2 bg-white text-amber-700 font-bold px-8 py-4 rounded-xl text-lg shadow-xl hover:shadow-2xl hover:bg-amber-50 transition-all duration-200 w-full sm:w-auto">
                  <UserPlus size={20} />
                  Register करें — Free
                </button>
              </Link>
              <Link href="/portal/login">
                <button className="flex items-center justify-center gap-2 border-2 border-white text-white font-bold px-8 py-4 rounded-xl text-lg hover:bg-white/15 transition-all duration-200 w-full sm:w-auto">
                  <LogIn size={20} />
                  पहले से है? Login करें
                  <ArrowRight size={18} />
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="bg-gray-900 text-gray-400 py-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center">
                  <Wheat size={16} className="text-white" />
                </div>
                <span className="text-white font-bold text-lg">Digital Viyapar</span>
              </div>
              <p className="text-sm text-center sm:text-right">
                © 2025 Digital Viyapar. All rights reserved.
              </p>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-600">
                Powered by Mandi Khata — Professional Mandi Accounting Software
              </p>
              <div className="flex gap-6 text-sm">
                <Link href="/portal/login" className="hover:text-amber-400 transition-colors">
                  Login
                </Link>
                <Link href="/portal/signup" className="hover:text-amber-400 transition-colors">
                  Register
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
