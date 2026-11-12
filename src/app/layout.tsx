import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pawl — Tighten-Only Guard Layer for Autonomous Agents",
  description:
    "Tighten-only guard layer between an AI agent and PayPal's agent-toolkit tools in sandbox. Deterministic money rules, intent Watcher, human approval, and ledger truth.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-[#07070a] text-zinc-100 min-h-screen flex flex-col antialiased selection:bg-rose-900/60 selection:text-white">
        {/* Navigation Bar */}
        <header className="border-b border-[#23242c] bg-[#0c0d14]/95 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="w-7 h-7 rounded-md bg-rose-600 flex items-center justify-center text-white shadow-sm group-hover:bg-rose-500 transition-colors">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.4}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base tracking-tight text-white font-sans">
                    Pawl
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/80 font-bold uppercase tracking-wider">
                    Guard
                  </span>
                </div>
              </Link>
            </div>

            <nav className="flex items-center space-x-5 text-xs">
              <Link
                href="/"
                className="font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Architecture
              </Link>
              <Link
                href="/simulator"
                className="font-semibold text-rose-300 hover:text-white transition-colors flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-rose-950/50 border border-rose-800/70"
              >
                <span>Simulator</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </Link>
              <Link
                href="/approvals"
                className="font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Approvals
              </Link>
              <Link
                href="/audit"
                className="font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Audit Chain
              </Link>
              <div className="hidden sm:flex items-center space-x-2 text-zinc-400 text-[11px] font-mono border-l border-[#23242c] pl-4">
                <span className="text-zinc-500">Nebius Token Factory</span>
                <span className="text-zinc-700">•</span>
                <span className="flex items-center space-x-1 text-[#76b900] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#76b900]"></span>
                  <span>NVIDIA Nemotron</span>
                </span>
              </div>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Footer */}
        <footer className="border-t border-[#23242c] bg-[#07070a] py-6 text-xs text-zinc-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <p className="text-zinc-400 font-medium">
                PayPal AI Hackathon
              </p>
            </div>
            <p className="font-mono text-zinc-500 text-[11px]">
              NVIDIA Nemotron 3 • Tighten-Only Ratchet & Ledger Truth
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
