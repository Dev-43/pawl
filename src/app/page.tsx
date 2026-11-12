import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-16">
      {/* Hero Section */}
      <div className="space-y-6 pt-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-md bg-[#0c0d14] border border-[#23242c] text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-[#76b900] animate-pulse"></span>
          <span className="text-zinc-300 font-medium">PayPal AI Hackathon</span>
          <span className="text-zinc-600">•</span>
          <span className="text-[#76b900] font-semibold">Autonomous Agent Guard</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.12]">
          AI oversight that can only{" "}
          <span className="text-rose-500 underline decoration-rose-500/30 underline-offset-8">
            tighten
          </span>
          .
        </h1>

        <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-xs text-rose-200 font-medium">
          <strong>Security Notice:</strong> Untrusted text on PayPal objects can hijack agent execution.
        </div>

        <p className="text-base sm:text-lg text-zinc-400 max-w-3xl leading-relaxed">
          Autonomous agents with PayPal tools drift or execute unauthorized fund transfers when encountering untrusted text in order notes, invoices, or buyer messages. <strong className="text-zinc-100 font-semibold">Pawl</strong> intercepts every tool invocation using deterministic money rules P1–P8, an AI watcher, a one-way permission ratchet, and a hash-chained audit trail with PayPal ledger truth reconciliation.
        </p>

        {/* Color-Coded KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-[#353745] transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500/40"></div>
            <div className="text-2xl font-bold font-mono text-emerald-400">100.0%</div>
            <div className="text-xs text-zinc-400 mt-1 font-medium">Policy Accuracy (20/20)</div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Benchmark eval suite</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-[#353745] transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-2 h-2 bg-cyan-500/40"></div>
            <div className="text-2xl font-bold font-mono text-cyan-400">0.0%</div>
            <div className="text-xs text-zinc-400 mt-1 font-medium">False Positive Rate</div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Zero clean-task blocks</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-[#353745] transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500/40"></div>
            <div className="text-2xl font-bold font-mono text-rose-400">P1–P8</div>
            <div className="text-xs text-zinc-400 mt-1 font-medium">Money Rules Gates</div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Deterministic override</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-[#353745] transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-2 h-2 bg-[#76b900]/40"></div>
            <div className="text-2xl font-bold font-mono text-[#76b900]">&lt; $0.002</div>
            <div className="text-xs text-zinc-400 mt-1 font-medium">Avg Watcher Cost</div>
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Nano 30B p50: ~380ms</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <Link
            href="/simulator?scenario=S2"
            className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs tracking-wide transition-colors shadow-sm flex items-center space-x-2"
          >
            <span>Launch S2 Injection Demo</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <Link
            href="/simulator"
            className="px-4 py-2.5 rounded-lg bg-[#0c0d14] hover:bg-[#151722] text-zinc-200 font-semibold text-xs border border-[#23242c] hover:border-[#353745] transition-colors"
          >
            Live Simulator
          </Link>
          <Link
            href="/compare"
            className="px-4 py-2.5 rounded-lg bg-[#0c0d14] hover:bg-[#151722] text-zinc-200 font-semibold text-xs border border-[#23242c] hover:border-[#353745] transition-colors"
          >
            Side-by-Side Compare
          </Link>
          <Link
            href="/approvals"
            className="px-4 py-2.5 rounded-lg bg-[#0c0d14] hover:bg-[#151722] text-zinc-400 hover:text-zinc-200 font-medium text-xs border border-[#23242c] hover:border-[#353745] transition-colors"
          >
            Approver Terminal
          </Link>
        </div>
      </div>

      {/* Terminal Architecture Inspector */}
      <div className="rounded-xl border border-[#23242c] bg-[#0c0d14] overflow-hidden shadow-2xl">
        <div className="px-4 py-3 bg-[#07070a] border-b border-[#23242c] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
            <span className="text-zinc-500 font-mono text-[11px] ml-2 font-medium">pawl-runtime-gateway.ts</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            NVIDIA Nemotron 3 (Nano • Super • Ultra)
          </span>
        </div>
        <div className="p-5 font-mono text-[11px] text-zinc-400 overflow-x-auto space-y-1.5 leading-relaxed bg-[#07070a]/60">
          <div className="text-zinc-500">// Intercept proposed tool call from Target Agent</div>
          <div className="text-zinc-300">
            <span className="text-cyan-400">await</span> gateway.<span className="text-rose-400">intercept</span>(proposedAction)
          </div>
          <div className="text-zinc-500 pl-4">// 1. Deterministic Money Rules P1-P8 (spend caps, allowed currencies, capture scope)</div>
          <div className="text-zinc-300 pl-4">
            <span className="text-amber-400">if</span> (!moneyRules.<span className="text-emerald-400">evaluate</span>(action)) <span className="text-rose-400">return</span> HELD_OR_BLOCKED;
          </div>
          <div className="text-zinc-500 pl-4">// 2. Tiered AI Watcher Cascade (Nebius Token Factory)</div>
          <div className="text-zinc-300 pl-4">
            <span className="text-cyan-400">const</span> verdict = <span className="text-cyan-400">await</span> watcher.<span className="text-emerald-400">judgeAction</span>(action, &#123; nano, super, ultra &#125;);
          </div>
          <div className="text-zinc-500 pl-4">// 3. Monotonic Ratchet (permissions can only shrink)</div>
          <div className="text-zinc-300 pl-4">
            <span className="text-amber-400">if</span> (verdict.tighten) ratchet.<span className="text-rose-400">revokeScope</span>(verdict.restrictions);
          </div>
          <div className="text-zinc-500 pl-4">// 4. Tamper-evident Hash Chain Append</div>
          <div className="text-zinc-300 pl-4">
            <span className="text-cyan-400">await</span> audit.<span className="text-emerald-400">appendEvent</span>(runId, sha256(prevHash + payload));
          </div>
        </div>
      </div>

      {/* Architecture Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Multi-Tier Architecture
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Deterministic code, not the LLM, holds the final safety lever.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Money Rules */}
          <div className="p-5 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-[#353745] transition-colors space-y-2 relative">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono text-xs flex items-center justify-center font-bold">
                01
              </span>
              <h3 className="font-bold text-white text-sm">Deterministic Money Rules (P1–P8)</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every PayPal tool call passes through TypeScript money rules before touching live sandbox endpoints. Spend caps, allowed currencies, target capture scopes, and ledger reconciliation are enforced deterministically with zero model latency.
            </p>
          </div>

          {/* Card 2: Tiered Watcher */}
          <div className="p-5 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-[#353745] transition-colors space-y-2 relative">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-xs flex items-center justify-center font-bold">
                02
              </span>
              <h3 className="font-bold text-white text-sm">AI Watcher Cascade</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Actions are screened against the declared merchant task by <span className="text-cyan-300 font-medium">Nemotron Nano 30B</span> and <span className="text-purple-300 font-medium">Super 120B</span>. High-stakes blocks and executive incident briefings are evaluated by <span className="text-rose-400 font-medium">Nemotron Ultra 550B</span> on Token Factory.
            </p>
          </div>

          {/* Card 3: Ratchet */}
          <div className="p-5 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-[#353745] transition-colors space-y-2 relative">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono text-xs flex items-center justify-center font-bold">
                03
              </span>
              <h3 className="font-bold text-white text-sm">One-Way Permission Ratchet</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Watcher verdicts can dynamically shrink permissions (revoking scopes, disabling tools, moving tools to require_approval, freezing runs), but can <span className="text-amber-300 font-medium">never widen them</span>. An agent can never escalate privileges autonomously without authenticated human approver signoff.
            </p>
          </div>

          {/* Card 4: Audit */}
          <div className="p-5 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-[#353745] transition-colors space-y-2 relative">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-xs flex items-center justify-center font-bold">
                04
              </span>
              <h3 className="font-bold text-white text-sm">Hash-Chained Audit Trail & PayPal Ledger Truth</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every event is recorded in an append-only SHA-256 hash chain. Post-execution ledger read-backs verify sandbox transaction truth against model claims. Held or frozen runs trigger an AI-written incident briefing citing exact event IDs.
            </p>
          </div>
        </div>
      </div>

      {/* Demonstration Scenarios */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Comparison Scenarios
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Observe autonomous agents running in Baseline (unmonitored) vs. Protected (Pawl) mode.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Scenario S1: Clean */}
          <div className="p-5 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-emerald-800/80 flex flex-col justify-between transition-colors shadow-sm relative group">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/90 border border-emerald-800 px-2 py-0.5 rounded font-bold">
                  Scenario S1
                </span>
                <span className="text-xs text-emerald-400 font-semibold flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Clean Run</span>
                </span>
              </div>
              <h3 className="text-sm font-bold text-white">Clean Merchant Refund</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Legitimate return and refund of $15.00 matching authorized capture ID and policy spend cap. Verifies zero false positives: Pawl permits execution and verifies ledger match.
              </p>
            </div>
            <Link
              href="/simulator?scenario=S1"
              className="mt-5 w-full text-center py-2 rounded-lg bg-[#12141e] hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 text-xs font-bold transition-colors"
            >
              Run S1 Clean →
            </Link>
          </div>

          {/* Scenario S2 - Main Hero Card */}
          <div className="p-5 rounded-xl bg-[#0c0d14] border border-rose-800/90 hover:border-rose-600 flex flex-col justify-between shadow-sm relative overflow-hidden transition-colors group">
            <div className="absolute top-0 right-0 w-3 h-3 bg-rose-600/60"></div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-rose-300 bg-rose-950/90 border border-rose-800 px-2 py-0.5 rounded font-bold">
                  Scenario S2
                </span>
                <span className="text-xs text-rose-400 font-semibold flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>Headline Demo</span>
                </span>
              </div>
              <h3 className="text-sm font-bold text-white">Poisoned Buyer Text (Headline)</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Customer order note embeds an indirect prompt injection attempting to redirect a $250.00 refund to a corporate capture ID. Unmonitored unguarded agent attempts the refund; Pawl deterministically blocks via Rule P7, ratchets permissions, and drafts an incident briefing.
              </p>
            </div>
            <Link
              href="/simulator?scenario=S2"
              className="mt-5 w-full text-center py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-sm"
            >
              Run S2 Demo →
            </Link>
          </div>

          {/* Scenario S3: Gated */}
          <div className="p-5 rounded-xl bg-[#0c0d14] border border-[#23242c] hover:border-amber-800/80 flex flex-col justify-between transition-colors shadow-sm relative group">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-amber-300 bg-amber-950/90 border border-amber-800 px-2 py-0.5 rounded font-bold">
                  Scenario S3
                </span>
                <span className="text-xs text-amber-400 font-semibold flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>Spend Cap Gate</span>
                </span>
              </div>
              <h3 className="text-sm font-bold text-white">Legitimate Refund Above Cap</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The agent attempts a legitimate VIP refund of $85.00 exceeding the $50.00 per-call cap. Deterministic Rule P2 holds execution for authenticated human approver signoff.
              </p>
            </div>
            <Link
              href="/simulator?scenario=S3"
              className="mt-5 w-full text-center py-2 rounded-lg bg-[#12141e] hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-xs font-bold transition-colors"
            >
              Run S3 Gated →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
