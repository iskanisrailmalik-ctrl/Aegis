import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, Smartphone, Database, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Aegis Finance Tracker",
  description: "Aegis Privacy Policy: 100% on-device SMS parsing, zero remote data collection, zero tracking.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Aegis Dashboard
        </Link>

        {/* Header */}
        <div className="space-y-3 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Aegis Privacy Policy</h1>
              <p className="text-xs text-slate-400">Last updated: July 2026 • Effective Version 1.0</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed pt-2">
            Aegis is designed with an **uncompromising privacy-first architecture**. All SMS parsing, financial tracking, voice intelligence, and transaction analytics operate **100% locally on your device**.
          </p>
        </div>

        {/* Key Guarantees */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <Lock className="w-5 h-5 text-teal-400" />
            <h2 className="text-sm font-semibold text-slate-200">Zero Cloud Telemetry</h2>
            <p className="text-xs text-slate-400">Your SMS messages and financial transactions never leave your phone.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <Smartphone className="w-5 h-5 text-teal-400" />
            <h2 className="text-sm font-semibold text-slate-200">On-Device Parsing</h2>
            <p className="text-xs text-slate-400">Regex engines & scam categorization execute locally inside WebAssembly/JS.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <Database className="w-5 h-5 text-teal-400" />
            <h2 className="text-sm font-semibold text-slate-200">Encrypted Vault</h2>
            <p className="text-xs text-slate-400">Sensitive documents and OTPs use AES-GCM local encryption.</p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">1. Information We Access</h2>
            <p>
              Depending on the version of Aegis you use:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong className="text-slate-200">Native Android Track:</strong> Reads incoming bank SMS messages locally to display financial transaction cards and detect scam messages.</li>
              <li><strong className="text-slate-200">Web / PWA Track:</strong> Operates strictly via manual copy-paste of SMS text. No SMS permissions are requested or used.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">2. How We Store Your Data</h2>
            <p>
              All application state, bank transaction logs, loan tracking schedules, and settings are saved in an **on-device SQLite database** and local browser storage. No data is transmitted to external servers, cloud databases, or third-party analytical trackers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">3. Third-Party Services & Analytics</h2>
            <p>
              Aegis contains **zero third-party tracking SDKs**, zero advertising frameworks, and zero analytics beacons (e.g. no Google Analytics, no Facebook Pixel, no Firebase Telemetry).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">4. Your Rights & Data Export</h2>
            <p>
              You maintain total control over your financial data. You can export all transaction history as a CSV file or wipe all local data at any time via the Settings page.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">5. Contact Information</h2>
            <p>
              If you have questions regarding this privacy policy or Aegis security, contact the development team at <a href="mailto:privacy@aegis.app" className="text-teal-400 underline">privacy@aegis.app</a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-6 text-xs text-slate-500 text-center">
          © 2026 Aegis. Designed & built for local-first financial sovereignty.
        </div>
      </div>
    </div>
  );
}
