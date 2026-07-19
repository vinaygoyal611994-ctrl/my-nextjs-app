import Head from "next/head";
import Link from "next/link";
import { Wheat, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Terms & Conditions — Digital Viyapar</title>
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
            <h1 className="text-4xl font-bold text-white mb-2">Terms & Conditions</h1>
            <p className="text-white/80 text-sm">Last updated: July 2025</p>
          </div>
        </section>

        {/* Content */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="space-y-10 text-gray-700 leading-relaxed">

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
                <p>
                  By registering for or using Digital Viyapar ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Service.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">2. Description of Service</h2>
                <p>
                  Digital Viyapar provides cloud-based accounting and record-keeping software designed for grain markets (anaj mandis) in India. The Service includes purchase and sale recording, party ledgers, daybook, financial reports, and a trader-facing portal.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">3. Account Registration</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>You must provide accurate and complete information when registering your firm.</li>
                  <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                  <li>You must notify us immediately if you suspect unauthorized access to your account.</li>
                  <li>One mobile number can only be registered to one firm account.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">4. Acceptable Use</h2>
                <p className="mb-2">You agree to use Digital Viyapar only for lawful purposes. You must not:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Enter false or fraudulent accounting records.</li>
                  <li>Attempt to access another firm's data.</li>
                  <li>Reverse-engineer, copy, or redistribute the software.</li>
                  <li>Use the Service in any way that violates applicable Indian laws or regulations.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Accuracy</h2>
                <p>
                  You are solely responsible for the accuracy of data entered into the system. Digital Viyapar is a recording tool — it does not validate the commercial or legal correctness of your transactions. Financial decisions based on data in the system are your own responsibility.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">6. Trader Portal</h2>
                <p>
                  Traders who access the trader portal can view their ledger data as entered by the aadhatiya. Digital Viyapar does not independently verify the correctness of this data. Any disputes regarding account balances must be resolved between the aadhatiya and the trader directly.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">7. Intellectual Property</h2>
                <p>
                  All software, design, and content of Digital Viyapar is the intellectual property of the platform and is protected by applicable copyright laws. You may not copy, modify, or distribute any part of the Service without written permission.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">8. Service Availability</h2>
                <p>
                  We strive to maintain high availability but do not guarantee uninterrupted access. Scheduled or emergency maintenance may temporarily affect availability. We are not liable for losses caused by downtime.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">9. Limitation of Liability</h2>
                <p>
                  Digital Viyapar shall not be liable for any indirect, incidental, or consequential damages arising from the use or inability to use the Service, including losses from data errors or system downtime. Our total liability shall not exceed the fees paid by you in the preceding three months.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">10. Termination</h2>
                <p>
                  We reserve the right to suspend or terminate your account if you violate these Terms. You may close your account at any time by contacting us. Upon termination, your data will be retained for 30 days before permanent deletion.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">11. Governing Law</h2>
                <p>
                  These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Rajasthan, India.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">12. Changes to Terms</h2>
                <p>
                  We may update these Terms from time to time. Updated Terms will be posted on this page. Continued use of the Service after changes constitutes acceptance of the new Terms.
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
