import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { Wheat, ArrowLeft, Phone, Info, Building2 } from "lucide-react";

export default function ForgotPassword() {
  const [firmId, setFirmId] = useState("");
  const [mobile, setMobile] = useState("");

  return (
    <>
      <Head>
        <title>Password Reset — Digital Viyapar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-green-50 flex flex-col">
        {/* Top bar */}
        <div className="p-4">
          <Link
            href="/portal/login"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-700 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Login
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
              <p className="text-gray-500 text-sm mt-1">Password Reset</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              {/* Info banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
                <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-semibold text-sm mb-1">
                    Password reset के लिए आढ़तिया से संपर्क करें
                  </p>
                  <p className="text-amber-700 text-xs leading-relaxed">
                    Security के लिए password reset सिर्फ आपके आढ़तिया ही कर सकते हैं।
                    नीचे अपनी details भरें और आढ़तिया को दिखाएं।
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Firm ID — informational */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={15} className="text-gray-400" />
                      आपका Firm ID
                    </span>
                  </label>
                  <input
                    type="number"
                    value={firmId}
                    onChange={(e) => setFirmId(e.target.value)}
                    placeholder="जैसे: 1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all bg-gray-50"
                    min={1}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    यह number आढ़तिया को बताएं
                  </p>
                </div>

                {/* Mobile — informational */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Phone size={15} className="text-gray-400" />
                      Registered Mobile Number
                    </span>
                  </label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10 digit mobile number"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all bg-gray-50"
                    maxLength={15}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    वही number जिससे account बना है
                  </p>
                </div>

                {/* Instructions box */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-blue-800 mb-3">
                    Password reset कैसे करें?
                  </h3>
                  <ol className="space-y-2">
                    {[
                      "ऊपर अपना Firm ID और Mobile number note करें",
                      "अपने आढ़तिया से मिलें या call करें",
                      "उन्हें अपना Firm ID और Mobile बताएं",
                      "वो आपका account delete करेंगे",
                      "फिर नया account बनाएं (/portal/signup)",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                        <span className="w-5 h-5 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Links */}
              <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col gap-2">
                <Link href="/portal/login">
                  <button className="w-full flex items-center justify-center gap-2 border border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold py-3 rounded-xl transition-colors text-sm">
                    <ArrowLeft size={16} />
                    Login page पर जाएं
                  </button>
                </Link>
                <p className="text-center text-xs text-gray-400 mt-1">
                  नया account बनाना है?{" "}
                  <Link href="/portal/signup" className="text-amber-600 hover:underline font-medium">
                    Register करें
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
