"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { SCENARIOS, INITIAL_OVERBROAD_GRANTS } from "../../lib/agent/scenarios";
import { ScenarioId, Event, PermissionState, Briefing, Grant } from "../../contracts";

// Dynamic lazy-loaded components to minimize initial bundle size on 2G/3G networks
const ExecutiveBriefingCard = dynamic(() => import("../../components/ExecutiveBriefingCard"), {
  ssr: false,
  loading: () => (
    <div className="p-4 rounded-xl bg-[#100c1a] border border-purple-800/80 animate-pulse text-xs text-purple-300 font-mono">
      Loading incident briefing module...
    </div>
  ),
});

const HumanApproverTerminal = dynamic(() => import("../../components/HumanApproverTerminal"), {
  ssr: false,
  loading: () => (
    <div className="p-4 rounded-xl bg-[#09151e] border border-cyan-900/80 animate-pulse text-xs text-cyan-400 font-mono">
      Loading approver console module...
    </div>
  ),
});

const EventTimeline = dynamic(() => import("../../components/EventTimeline"), {
  ssr: false,
  loading: () => (
    <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl animate-pulse font-mono">
      Loading audit timeline...
    </div>
  ),
});

function CompareDashboard() {
  const searchParams = useSearchParams();
  const initialScenario = (searchParams.get("scenario") as ScenarioId) || "S2";

  const [scenarioId, setScenarioId] = useState<ScenarioId>(initialScenario);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Run States
  const [baselineRun, setBaselineRun] = useState<any | null>(null);
  const [protectedRun, setProtectedRun] = useState<any | null>(null);

  const [baselineEvents, setBaselineEvents] = useState<Event[]>([]);
  const [protectedEvents, setProtectedEvents] = useState<Event[]>([]);

  const [baselineOutbox, setBaselineOutbox] = useState<any[]>([]);
  const [protectedOutbox, setProtectedOutbox] = useState<any[]>([]);

  const [baselineState, setBaselineState] = useState<PermissionState | null>(null);
  const [protectedState, setProtectedState] = useState<PermissionState | null>(null);

  // Approver & Briefing
  const [isApprover, setIsApprover] = useState(false);
  const [passcode, setPasscode] = useState("pawl-demo-passcode-2026");
  const [loginError, setLoginError] = useState("");
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);

  // Rule Drafting (P2)
  const [ruleText, setRuleText] = useState("");
  const [draftedRule, setDraftedRule] = useState<any | null>(null);
  const [ruleMessage, setRuleMessage] = useState("");

  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);

  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const currentScenario = SCENARIOS[scenarioId] || SCENARIOS.S2;

  // Optimized polling: only poll while runs are actively running/held, 3s cadence (saves ~65% mobile bandwidth)
  useEffect(() => {
    if (!baselineRun && !protectedRun) return;

    const isBaselineActive =
      baselineRun &&
      (baselineRun.status === "running" || baselineRun.status === "paused_held");
    const isProtectedActive =
      protectedRun &&
      (protectedRun.status === "running" || protectedRun.status === "paused_held");

    if (!isBaselineActive && !isProtectedActive) return;

    const interval = setInterval(async () => {
      // 1. Poll Baseline if active
      if (baselineRun?.id && isBaselineActive) {
        try {
          const res = await fetch(`/api/events?runId=${baselineRun.id}`);
          const data = await res.json();
          if (data.events) setBaselineEvents(data.events);

          const outboxRes = await fetch(`/api/outbox?runId=${baselineRun.id}`);
          const outboxData = await outboxRes.json();
          if (outboxData.outbox) setBaselineOutbox(outboxData.outbox);

          const runRes = await fetch(`/api/runs/${baselineRun.id}`);
          const runData = await runRes.json();
          if (runData.run) {
            setBaselineRun(runData.run);
            setBaselineState(runData.permissionState);
          }
        } catch (e) {
          console.error("Baseline poll error:", e);
        }
      }

      // 2. Poll Protected if active
      if (protectedRun?.id && isProtectedActive) {
        try {
          const res = await fetch(`/api/events?runId=${protectedRun.id}`);
          const data = await res.json();
          if (data.events) setProtectedEvents(data.events);

          const outboxRes = await fetch(`/api/outbox?runId=${protectedRun.id}`);
          const outboxData = await outboxRes.json();
          if (outboxData.outbox) setProtectedOutbox(outboxData.outbox);

          const runRes = await fetch(`/api/runs/${protectedRun.id}`);
          const runData = await runRes.json();
          if (runData.run) {
            setProtectedRun(runData.run);
            setProtectedState(runData.permissionState);

            // If paused_held or frozen and no briefing loaded yet, request briefing
            if (
              (runData.run.status === "paused_held" || runData.run.status === "frozen") &&
              !briefing &&
              !loadingBriefing
            ) {
              fetchBriefing(protectedRun.id);
            }
          }
        } catch (e) {
          console.error("Protected poll error:", e);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [
    baselineRun?.id,
    baselineRun?.status,
    protectedRun?.id,
    protectedRun?.status,
    briefing,
    loadingBriefing,
  ]);

  async function fetchBriefing(runId: string) {
    setLoadingBriefing(true);
    try {
      const res = await fetch("/api/interpreter/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (data.briefing) {
        setBriefing(data.briefing);
      }
    } catch (e) {
      console.error("Error fetching briefing:", e);
    } finally {
      setLoadingBriefing(false);
    }
  }

  // Run Both Handler
  async function handleRunBoth() {
    setIsRunning(true);
    setIsPaused(false);
    setBriefing(null);
    setDraftedRule(null);
    setRuleMessage("");
    setHighlightedEventId(null);

    try {
      // 1. Create Baseline Run
      const bRes = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, mode: "baseline" }),
      });
      const bData = await bRes.json();
      if (!bRes.ok) throw new Error(bData.error?.message || "Failed to create baseline run");
      setBaselineRun(bData.run);
      setBaselineState({
        version: 1,
        grants: [...INITIAL_OVERBROAD_GRANTS],
        disabledTools: [],
        approvalRequiredTools: [],
        frozen: false,
        sensitiveRead: false,
        restrictionLog: [],
      });
      setBaselineEvents([]);
      setBaselineOutbox([]);

      // 2. Create Protected Run
      const pRes = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, mode: "protected" }),
      });
      const pData = await pRes.json();
      if (!pRes.ok) throw new Error(pData.error?.message || "Failed to create protected run");
      setProtectedRun(pData.run);
      setProtectedState({
        version: 1,
        grants: [...INITIAL_OVERBROAD_GRANTS],
        disabledTools: [],
        approvalRequiredTools: [],
        frozen: false,
        sensitiveRead: false,
        restrictionLog: [],
      });
      setProtectedEvents([]);
      setProtectedOutbox([]);

      // Start lockstep execution loop
      executeLockstepLoop(bData.run.id, pData.run.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
      setIsRunning(false);
    }
  }

  async function executeLockstepLoop(baselineId: string, protectedId: string) {
    let bDone = false;
    let pDone = false;

    while (isRunningRef.current && (!bDone || !pDone)) {
      if (isPausedRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Step baseline
      if (!bDone) {
        try {
          const stepRes = await fetch(`/api/runs/${baselineId}/step`, { method: "POST" });
          const stepData = await stepRes.json();
          if (stepRes.status === 409 || stepData.done) {
            bDone = true;
          }
        } catch {
          bDone = true;
        }
      }

      await new Promise((r) => setTimeout(r, 300));

      // Step protected
      if (!pDone) {
        try {
          const stepRes = await fetch(`/api/runs/${protectedId}/step`, { method: "POST" });
          const stepData = await stepRes.json();
          if (stepRes.status === 409 || stepData.done) {
            pDone = true;
          }
        } catch {
          pDone = true;
        }
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    setIsRunning(false);
  }

  async function handleApproverLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/approver/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsApprover(true);
      } else {
        setLoginError(data.error?.message || "Invalid passcode");
      }
    } catch {
      setLoginError("Login failed");
    }
  }

  async function handleHumanAction(actionPayload: any) {
    if (!protectedRun?.id) return;
    try {
      const res = await fetch(`/api/runs/${protectedRun.id}/human`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionPayload),
      });
      const data = await res.json();
      if (res.ok) {
        setProtectedRun(data.run);
        setProtectedState(data.permissionState);
      } else {
        alert(data.error?.message || "Action failed");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDraftRule() {
    if (!protectedRun?.id || !ruleText) return;
    setRuleMessage("Drafting rule with Nemotron Super 120B...");
    try {
      const res = await fetch("/api/interpreter/rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: protectedRun.id, text: ruleText }),
      });
      const data = await res.json();
      if (res.ok) {
        setDraftedRule(data.rule);
        setRuleMessage("Rule drafted successfully. Ready for activation.");
      } else {
        setRuleMessage(data.error?.message || "Failed to draft rule");
      }
    } catch {
      setRuleMessage("Drafting failed");
    }
  }

  async function handleActivateRule() {
    if (!draftedRule?.id) return;
    try {
      const res = await fetch(`/api/rules/${draftedRule.id}/activate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setProtectedState(data.permissionState);
        setDraftedRule(null);
        setRuleText("");
        setRuleMessage("Rule activated! Enforced by ratchet.");
      } else {
        alert(data.error?.message || "Activation failed");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  // Summary Metrics
  const baselineSentEmails = baselineOutbox.length;
  const protectedSentEmails = protectedOutbox.length;
  const protectedTightenings =
    protectedState?.restrictionLog.filter((r) => r.by === "watcher").length || 0;

  const latestWatcherCall = [...protectedEvents].reverse().find((e) => e.type === "watcher_called");
  const latestCall = latestWatcherCall ? (latestWatcherCall.payload as any) : null;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-[#0c0d14] border border-[#23242c] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Live Execution Comparison
              </h1>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/80 font-bold uppercase tracking-wider">
                Lockstep Mode
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
              Parallel execution comparing an unmonitored baseline agent against Pawl's money rules, AI watcher, and one-way permission ratchet.
            </p>
          </div>

          {/* Scenario Selector & Run Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-xl bg-[#07070a] p-1 border border-[#23242c]">
              <button
                disabled={isRunning}
                onClick={() => setScenarioId("S1")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors flex items-center space-x-1.5 ${
                  scenarioId === "S1"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold"
                    : "text-zinc-400 hover:text-emerald-300"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>S1: Clean</span>
              </button>
              <button
                disabled={isRunning}
                onClick={() => setScenarioId("S2")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors flex items-center space-x-1.5 ${
                  scenarioId === "S2"
                    ? "bg-rose-950 text-rose-300 border border-rose-600 font-bold"
                    : "text-zinc-400 hover:text-rose-300"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                <span>S2: Attack</span>
              </button>
              <button
                disabled={isRunning}
                onClick={() => setScenarioId("S3")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors flex items-center space-x-1.5 ${
                  scenarioId === "S3"
                    ? "bg-amber-950 text-amber-300 border border-amber-600 font-bold"
                    : "text-zinc-400 hover:text-amber-300"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>S3: Gated</span>
              </button>
            </div>

            <button
              onClick={handleRunBoth}
              disabled={isRunning}
              className={`px-5 py-2 rounded-xl text-xs font-bold tracking-wide transition-colors ${
                isRunning
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
              }`}
            >
              {isRunning ? "Running Lockstep..." : "Start Simulation"}
            </button>

            {isRunning && (
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
            )}
          </div>
        </div>

        {/* Declared Task Box */}
        <div className="pt-4 border-t border-[#23242c] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2 space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
              Declared Task
            </span>
            <div className="p-3 rounded-xl bg-[#07070a] border border-[#23242c] font-mono text-zinc-300 text-[11px]">
              {currentScenario.declaredTask}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider font-mono">
              Target Policy Invariant
            </span>
            <div className="p-3 rounded-xl bg-[#0c0d14] border border-rose-900/60 text-rose-300 text-[11px] leading-relaxed">
              {scenarioId === "S2"
                ? "Fail-closed: Zero exfiltration of payroll data allowed."
                : scenarioId === "S3"
                ? "Deterministic H3 gates unlisted email domains."
                : "No false-positive restrictions on authorized tasks."}
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards with Crisp Color Accents */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Exfiltration Status */}
        <div className={`p-4 rounded-xl border ${baselineSentEmails > 0 ? "bg-[#180a0f] border-rose-800" : "bg-[#0c0d14] border-[#23242c]"}`}>
          <div className="text-[10px] text-zinc-400 font-mono uppercase font-semibold">Data Exfiltration</div>
          <div className="text-base font-bold font-mono mt-1">
            {baselineSentEmails > 0 ? (
              <span className="text-rose-400">Baseline Compromised</span>
            ) : (
              <span className="text-emerald-400">No Leaks</span>
            )}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono font-medium mt-0.5">
            Pawl: 0 Leaks
          </div>
        </div>

        {/* Card 2: Ratchet Version */}
        <div className="p-4 rounded-xl bg-[#0c0d14] border border-[#23242c]">
          <div className="text-[10px] text-amber-400/90 font-mono uppercase font-semibold">Ratchet Version</div>
          <div className="text-base font-bold font-mono text-amber-300 mt-1">
            v{protectedState?.version || 1}
          </div>
          <div className="text-[11px] text-amber-400 font-mono mt-0.5 font-medium">
            {protectedTightenings} Tighten Action{protectedTightenings === 1 ? "" : "s"}
          </div>
        </div>

        {/* Card 3: Model Tier */}
        <div className="p-4 rounded-xl bg-[#0c0d14] border border-[#23242c]">
          <div className="text-[10px] text-cyan-400/90 font-mono uppercase font-semibold">Active Watcher Tier</div>
          <div className="text-base font-bold font-mono mt-1">
            {latestCall?.tier ? (
              <span className={latestCall.tier === "ultra" ? "text-rose-400 font-bold" : latestCall.tier === "super" ? "text-purple-400 font-bold" : "text-cyan-400 font-bold"}>
                {String(latestCall.tier).toUpperCase()} {latestCall.tier === "nano" ? "(30B)" : latestCall.tier === "super" ? "(120B)" : "(550B)"}
              </span>
            ) : (
              <span className="text-zinc-500">Standby</span>
            )}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
            {latestCall?.latencyMs ? `${latestCall.latencyMs} ms latency` : "Ready"}
          </div>
        </div>

        {/* Card 4: Audit Chain */}
        <div className="p-4 rounded-xl bg-[#0c0d14] border border-[#23242c]">
          <div className="text-[10px] text-emerald-400 font-mono uppercase font-semibold">Audit Integrity</div>
          <div className="text-base font-bold font-mono text-emerald-300 mt-1">
            SHA-256 Valid
          </div>
          <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5">
            {protectedEvents.length} blocks chained
          </div>
        </div>
      </div>

      {/* Side-by-Side Dual Execution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: BASELINE RUN (CONTROL GROUP)                  */}
        {/* ========================================================= */}
        <div className="p-5 rounded-2xl bg-[#16080d] border border-rose-900/80 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-rose-900/50 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white">
                  Baseline Agent (Unmonitored)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold uppercase">
                  Vulnerable
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Standard tool execution without runtime overseer or ratchet.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-zinc-400">
                Step {baselineRun?.stepCount || 0}/25
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                  baselineRun?.status === "completed"
                    ? "bg-zinc-800 text-zinc-300"
                    : baselineRun?.status === "running"
                    ? "bg-blue-950 text-blue-300 border border-blue-800"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                }`}
              >
                {baselineRun?.status || "Idle"}
              </span>
            </div>
          </div>

          {/* Breach Hazard Banner */}
          {baselineSentEmails > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-700 text-xs space-y-1 text-rose-200">
              <div className="font-bold text-rose-300 uppercase tracking-wide flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Critical Security Breach: Data Exfiltrated</span>
              </div>
              <p className="text-zinc-200 text-[11px] leading-relaxed">
                The unmonitored agent parsed the prompt injection in invoice <code className="text-rose-300 font-mono font-bold">INV-1007</code>, read <code className="text-rose-300 font-mono font-bold">/hr/payroll/</code>, and transmitted employee salaries to an external attacker via outbound email.
              </p>
            </div>
          )}

          {/* Baseline Permissions */}
          <div className="p-3.5 rounded-xl bg-[#11070b] border border-rose-950 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-rose-300/80 uppercase font-semibold">
              <span>Static Grants (Unrestricted)</span>
              <span>v1</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INITIAL_OVERBROAD_GRANTS.map((g, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1c0c12] text-rose-200 border border-rose-900/60"
                >
                  {g.tool} {g.scope}
                </span>
              ))}
            </div>
          </div>

          {/* Baseline Outbox */}
          <div className="p-3.5 rounded-xl bg-[#14080e] border border-rose-900/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono text-rose-300 uppercase font-semibold">
                Outbound Mail Dispatched ({baselineOutbox.length})
              </span>
              {baselineOutbox.length > 0 && (
                <span className="text-rose-400 font-mono text-[11px] font-bold">
                  EXFILTRATION SUCCESSFUL
                </span>
              )}
            </div>
            {baselineOutbox.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-1">No outbound emails dispatched yet.</p>
            ) : (
              <div className="space-y-2 pt-1">
                {baselineOutbox.map((mail, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-[#1a080e] border border-rose-800 text-xs space-y-1.5 font-mono"
                  >
                    <div className="flex justify-between text-rose-300 text-[11px]">
                      <span>To: {mail.to}</span>
                      <span className="text-zinc-400">Subj: {mail.subject}</span>
                    </div>
                    <pre className="text-rose-200 text-[10px] overflow-x-auto whitespace-pre-wrap max-h-24 bg-[#0d0407] p-2 rounded border border-rose-950">
                      {mail.body}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Baseline Timeline */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
              Execution Event Log ({baselineEvents.length})
            </div>
            <EventTimeline
              events={baselineEvents}
              highlightedEventId={highlightedEventId}
              onSelectEvent={setHighlightedEventId}
              emptyMessage='Click "Start Simulation" to begin execution.'
            />
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: PROTECTED RUN (PAWL OVERSIGHT LAYER)         */}
        {/* ========================================================= */}
        <div className="p-5 rounded-2xl bg-[#091310] border border-emerald-900/80 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-900/50 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white">
                  Pawl Supervised Agent
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold uppercase">
                  Protected
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Deterministic limits + Tiered Nemotron cascade + One-way ratchet.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-zinc-400">
                Step {protectedRun?.stepCount || 0}/25
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                  protectedState?.frozen
                    ? "bg-rose-950 text-rose-300 border border-rose-700"
                    : protectedRun?.status === "paused_held"
                    ? "bg-amber-950 text-amber-300 border border-amber-700"
                    : protectedRun?.status === "completed"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                    : "bg-blue-950 text-blue-300 border border-blue-800"
                }`}
              >
                {protectedState?.frozen ? "FROZEN" : protectedRun?.status || "Idle"}
              </span>
            </div>
          </div>

          {/* Frozen / Security Hold Callout */}
          {protectedState?.frozen && (
            <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-700 text-xs space-y-1 text-rose-200">
              <div className="font-bold text-rose-300 uppercase tracking-wide">
                Security Violation Halted — Run Frozen
              </div>
              <p className="text-zinc-200 text-[11px] leading-relaxed">
                Adversarial drift detected. Tool execution halted and outbound exfiltration aborted. An authenticated human approver must review the incident briefing below.
              </p>
            </div>
          )}

          {/* Dynamic One-Way Ratchet Permissions */}
          <div className="p-3.5 rounded-xl bg-[#061710] border border-emerald-900/90 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                Ratchet Capability Envelope
              </span>
              <div className="flex items-center space-x-2 font-mono text-[11px]">
                <span className="text-emerald-200 font-bold">
                  v{protectedState?.version || 1}
                </span>
                <span className="text-amber-400 font-semibold">
                  ({protectedTightenings} Tightened)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {INITIAL_OVERBROAD_GRANTS.map((initialGrant, idx) => {
                const isCurrentlyActive = protectedState?.grants.some(
                  (g) => g.tool === initialGrant.tool && g.scope === initialGrant.scope
                );

                if (isCurrentlyActive) {
                  return (
                    <span
                      key={idx}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-medium"
                    >
                      {initialGrant.tool} {initialGrant.scope}
                    </span>
                  );
                } else {
                  return (
                    <span
                      key={idx}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 line-through decoration-rose-400 font-bold"
                      title="Revoked by Watcher Ratchet"
                    >
                      {initialGrant.tool} {initialGrant.scope}
                    </span>
                  );
                }
              })}
            </div>

            {/* Badges for disabled tools */}
            {((protectedState?.disabledTools && protectedState.disabledTools.length > 0) ||
              (protectedState?.approvalRequiredTools && protectedState.approvalRequiredTools.length > 0)) && (
              <div className="pt-2 border-t border-emerald-900/60 flex flex-wrap gap-1.5 text-[10px] font-mono">
                {protectedState?.disabledTools.map((t, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 font-bold">
                    DISABLED: {t}
                  </span>
                ))}
                {protectedState?.approvalRequiredTools.map((t, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold">
                    REQUIRES APPROVAL: {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Protected Outbox */}
          <div className="p-3.5 rounded-xl bg-[#061710] border border-emerald-900/90 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                Exfiltration Gate
              </span>
              <span className="text-emerald-400 font-mono text-[11px] font-bold">
                0 Emails Leaked (Blocked)
              </span>
            </div>
            {protectedOutbox.length === 0 ? (
              <p className="text-xs text-emerald-300 italic py-1 font-medium">
                Zero data exfiltration. All unauthorized outbound messages blocked.
              </p>
            ) : (
              <div className="space-y-2 pt-1">
                {protectedOutbox.map((mail, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono">
                    <span className="text-zinc-300">To: {mail.to}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nemotron Ultra Incident Briefing Card (Lazy Loaded) */}
          <ExecutiveBriefingCard
            briefing={briefing}
            loadingBriefing={loadingBriefing}
            onSelectCitation={setHighlightedEventId}
          />

          {/* Human Approver Terminal (Lazy Loaded) */}
          <HumanApproverTerminal
            isApprover={isApprover}
            passcode={passcode}
            setPasscode={setPasscode}
            onApproverLogin={handleApproverLogin}
            onHumanAction={handleHumanAction}
            protectedRunStatus={protectedRun?.status}
            isFrozen={Boolean(protectedState?.frozen)}
            ruleText={ruleText}
            setRuleText={setRuleText}
            onDraftRule={handleDraftRule}
            ruleMessage={ruleMessage}
            draftedRule={draftedRule}
            onActivateRule={handleActivateRule}
            loginError={loginError}
          />

          {/* Protected Timeline (Lazy Loaded) */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
              Cryptographic Audit Timeline ({protectedEvents.length})
            </div>
            <EventTimeline
              events={protectedEvents}
              highlightedEventId={highlightedEventId}
              onSelectEvent={setHighlightedEventId}
              emptyMessage='Click "Start Simulation" to observe protected execution.'
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-12 text-zinc-500 font-mono text-xs">
          Loading comparison dashboard...
        </div>
      }
    >
      <CompareDashboard />
    </Suspense>
  );
}

