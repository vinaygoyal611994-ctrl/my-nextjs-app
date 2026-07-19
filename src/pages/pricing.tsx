import Head from "next/head";
import Link from "next/link";
import { Wheat, CheckCircle, ArrowLeft, Zap, Building2, Star } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    desc: "Perfect to get started and explore all features.",
    highlight: false,
    badge: "",
    features: [
      "1 Firm / Mandi",
      "Up to 100 parties",
      "Purchase & Sale recording",
      "Party ledger & daybook",
      "Receipt & Payment entries",
      "Basic reports",
      "Trader portal access",
      "Email support",
    ],
    cta: "Start Free",
    ctaHref: "/auth/register",
    ctaStyle: "border-2 border-amber-600 text-amber-600 hover:bg-amber-50",
  },
  {
    name: "Professional",
    price: "₹499",
    period: "/ month",
    desc: "For active mandis with large party networks and advanced needs.",
    highlight: true,
    badge: "Most Popular",
    features: [
      "Everything in Starter",
      "Unlimited parties",
      "Multiple users (malik + munim)",
      "Advance (Uchanti) management",
      "Hammali & staff payroll",
      "Govt dues tracking",
      "Bank reconciliation",
      "Priority support",
      "Data export (Excel/PDF)",
    ],
    cta: "Start Free Trial",
    ctaHref: "/auth/register",
    ctaStyle: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For large mandis or multi-branch operations with custom requirements.",
    highlight: false,
    badge: "",
    features: [
      "Everything in Professional",
      "Multiple branches / firms",
      "Custom chart of accounts",
      "API access",
      "Dedicated onboarding",
      "Custom reports",
      "SLA-backed uptime",
      "Phone & WhatsApp support",
    ],
    cta: "Contact Us",
    ctaHref: "/about",
    ctaStyle: "border-2 border-gray-300 text-gray-700 hover:bg-gray-50",
  },
];

export default function PricingPage() {
  return (
    <>
      <Head>
        <title>Pricing — Digital Viyapar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-white font-sans">
        {/* Navbar */}
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center shadow-md">
                <Wheat size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Digital Viyapar</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/auth/register" className="hidden sm:block text-sm font-medium text-gray-600 hover:text-amber-600 transition-colors">Register</Link>
              <Link href="/auth/login">
                <button className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">Login</button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="bg-gradient-to-br from-amber-500 to-green-600 py-16 px-4 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Simple, Honest Pricing</h1>
          <p className="text-white/85 text-lg max-w-xl mx-auto">
            Start free and upgrade as your mandi grows. No hidden charges, no surprises.
          </p>
        </section>

        {/* Plans */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl border overflow-hidden shadow-sm flex flex-col ${
                  plan.highlight ? "border-amber-400 shadow-xl ring-2 ring-amber-400" : "border-gray-200"
                }`}
              >
                {plan.badge && (
                  <div className="bg-amber-500 text-white text-xs font-bold text-center py-1.5 tracking-wide">
                    {plan.badge}
                  </div>
                )}
                <div className="p-8 flex-1 flex flex-col">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                    <p className="text-gray-500 text-sm mb-4">{plan.desc}</p>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                      {plan.period && <span className="text-gray-500 text-sm mb-1">{plan.period}</span>}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                        <span className="text-gray-700 text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={plan.ctaHref}>
                    <button className={`w-full font-bold py-3 rounded-xl transition-colors text-base ${plan.ctaStyle}`}>
                      {plan.cta}
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {[
                {
                  q: "Is the free plan really free?",
                  a: "Yes — the Starter plan is completely free with no time limit. You can use it indefinitely for a single mandi with up to 100 parties.",
                },
                {
                  q: "Can I upgrade or downgrade later?",
                  a: "Absolutely. You can upgrade to Professional at any time and your data stays intact. Downgrading is also possible.",
                },
                {
                  q: "Is my data secure?",
                  a: "Yes. All data is stored securely and is accessible only to authorized users of your firm. No one else can see your records.",
                },
                {
                  q: "Do traders need to pay to use the portal?",
                  a: "No — the trader portal is always free for traders. They can view their account, bills, and balances at no cost.",
                },
                {
                  q: "What payment methods are accepted?",
                  a: "We accept UPI, bank transfer, and debit/credit cards for Professional plan payments.",
                },
              ].map((item) => (
                <div key={item.q} className="border border-gray-200 rounded-xl p-6">
                  <h4 className="font-bold text-gray-900 mb-2">{item.q}</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-green-600 flex items-center justify-center">
              <Wheat size={16} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">Digital Viyapar</span>
          </div>
          <p className="text-sm">© 2025 Digital Viyapar. All rights reserved.</p>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-800 flex flex-wrap justify-center gap-6 text-sm">
          <Link href="/" className="hover:text-amber-400 transition-colors">Home</Link>
          <Link href="/about" className="hover:text-amber-400 transition-colors">About Us</Link>
          <Link href="/pricing" className="hover:text-amber-400 transition-colors">Pricing</Link>
          <Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-amber-400 transition-colors">Terms & Conditions</Link>
          <Link href="/auth/register" className="hover:text-amber-400 transition-colors">Register</Link>
          <Link href="/auth/login" className="hover:text-amber-400 transition-colors">Login</Link>
        </div>
      </div>
    </footer>
  );
}
