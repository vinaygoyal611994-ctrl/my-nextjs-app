import Head from "next/head";
import Link from "next/link";
import { Wheat, Target, Users, Shield, TrendingUp, ArrowLeft } from "lucide-react";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About Us — Digital Viyapar</title>
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
        <section className="bg-gradient-to-br from-amber-500 to-green-600 py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-6 transition-colors">
              <ArrowLeft size={14} /> Back to Home
            </Link>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">About Digital Viyapar</h1>
            <p className="text-white/85 text-lg max-w-2xl mx-auto">
              Built for India's grain markets — helping aadhatiya manage their mandi digitally, accurately, and effortlessly.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="text-amber-600 font-semibold text-sm uppercase tracking-wider">Our Mission</span>
                <h2 className="text-3xl font-bold text-gray-900 mt-2 mb-4">Bringing Mandis into the Digital Age</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  India's grain markets (anaj mandis) have been the backbone of the agricultural economy for generations. Yet most mandi accounting is still done in paper registers — prone to errors, hard to audit, and difficult to access.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Digital Viyapar was built to solve this. We give aadhatiya a complete, easy-to-use accounting system — purchase recording, party ledgers, daybook, reports, and a trader portal — all in one place, accessible from any device.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Target, label: "Purpose-built", desc: "Designed specifically for anaj mandis", color: "bg-amber-50 text-amber-600" },
                  { icon: Users, label: "Multi-party", desc: "Kisan, trader, and staff ledgers", color: "bg-green-50 text-green-600" },
                  { icon: Shield, label: "Secure", desc: "Your data is safe and private", color: "bg-blue-50 text-blue-600" },
                  { icon: TrendingUp, label: "Real-time", desc: "Live balances and reports", color: "bg-purple-50 text-purple-600" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={`rounded-xl p-5 ${item.color.split(" ")[0]}`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${item.color}`}>
                        <Icon size={20} />
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm mb-1">{item.label}</h4>
                      <p className="text-gray-500 text-xs">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Story */}
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <span className="text-amber-600 font-semibold text-sm uppercase tracking-wider">Our Story</span>
            <h2 className="text-3xl font-bold text-gray-900 mt-2 mb-6">Why We Built This</h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                Mandi accounting is complex. A single day's work can involve dozens of purchase entries, multiple trader bills with different charge structures, cash and bank payments, advance recoveries, and government dues — all of which must balance to the rupee.
              </p>
              <p>
                We saw aadhatiya spending hours reconciling registers at night, struggling to answer a trader's balance query instantly, and having no easy way to track outstanding dues across hundreds of parties.
              </p>
              <p>
                Digital Viyapar was built to change that. Every feature — from purchase recording to the contra entry for cash withdrawals — was designed with real mandi workflows in mind.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-gradient-to-br from-amber-500 to-green-600 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Digitize Your Mandi?</h2>
          <p className="text-white/80 mb-8">Register in 2 minutes — completely free.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <button className="bg-white text-amber-700 font-bold px-8 py-3 rounded-xl hover:bg-amber-50 transition-colors">Register Free</button>
            </Link>
            <Link href="/auth/login">
              <button className="border-2 border-white text-white font-bold px-8 py-3 rounded-xl hover:bg-white/15 transition-colors">Login</button>
            </Link>
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
