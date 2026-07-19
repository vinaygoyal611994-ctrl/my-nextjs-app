import Head from "next/head";
import Link from "next/link";
import { Wheat, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Digital Viyapar</title>
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
        <section className="bg-gradient-to-br from-amber-500 to-green-600 py-14 px-4">
          <div className="max-w-3xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-6 transition-colors">
              <ArrowLeft size={14} /> Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
            <p className="text-white/80 text-sm">Last updated: July 2025</p>
          </div>
        </section>

        {/* Content */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto prose prose-gray max-w-none">
            <div className="space-y-10 text-gray-700 leading-relaxed">

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
                <p>
                  Digital Viyapar ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect information when you use our mandi accounting software and related services.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Registration data:</strong> Firm name, address, admin name, and mobile number when you create a firm account.</li>
                  <li><strong>Transaction data:</strong> Purchase, sale, payment, and ledger entries you create within the software.</li>
                  <li><strong>Party data:</strong> Names, mobile numbers, addresses, and financial details of your kisan, traders, and other parties.</li>
                  <li><strong>Usage data:</strong> Basic logs of how the software is used, for performance and error monitoring.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>To provide and operate the Digital Viyapar accounting service.</li>
                  <li>To authenticate users and maintain account security.</li>
                  <li>To generate ledgers, reports, and financial statements within your firm.</li>
                  <li>To improve the software based on usage patterns.</li>
                  <li>To send important service notifications (not marketing emails without consent).</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">4. Data Isolation</h2>
                <p>
                  Each firm's data is strictly isolated. Users of one firm cannot access data belonging to another firm under any circumstances. All database queries are scoped by firm ID.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">5. Trader Portal</h2>
                <p>
                  Traders who register on the trader portal can only view their own ledger data as recorded by their aadhatiya. They cannot view data of other parties or modify any records.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Security</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>All passwords are hashed using bcrypt before storage — we never store plaintext passwords.</li>
                  <li>Session tokens are stored as HTTP-only cookies to prevent XSS attacks.</li>
                  <li>Database access is restricted to the application server only.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">7. Data Sharing</h2>
                <p>
                  We do not sell, rent, or share your data with third parties for marketing purposes. Data may be shared only if required by law or court order.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">8. Data Retention</h2>
                <p>
                  Your data is retained for as long as your account is active. You may request deletion of your firm account and all associated data by contacting us. Deletion is processed within 30 days.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">9. Cookies</h2>
                <p>
                  We use essential cookies only — for login sessions and security. We do not use advertising or tracking cookies.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">10. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. Changes will be posted on this page with a revised date. Continued use of the service after changes constitutes acceptance.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">11. Contact</h2>
                <p>
                  For any privacy-related questions, please contact us through the Digital Viyapar platform.
                </p>
              </div>

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
