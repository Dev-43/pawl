"use client";

import { Event } from "../contracts";

interface EventTimelineProps {
  events: Event[];
  highlightedEventId: string | null;
  onSelectEvent: (id: string) => void;
  emptyMessage: string;
}

export default function EventTimeline({
  events,
  highlightedEventId,
  onSelectEvent,
  emptyMessage,
}: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
      {events.map((ev) => (
        <EventCard
          key={ev.id}
          event={ev}
          isHighlighted={highlightedEventId === ev.id}
          onClick={() => onSelectEvent(ev.id)}
        />
      ))}
    </div>
  );
}

function EventCard({
  event,
  isHighlighted,
  onClick,
}: {
  event: Event;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const payload = event.payload as Record<string, unknown>;

  const getBadgeStyle = () => {
    switch (event.type) {
      case "action_executed":
        return "bg-emerald-950 text-emerald-300 border-emerald-700 font-bold";
      case "action_blocked":
        return "bg-rose-950 text-rose-300 border-rose-700 font-bold";
      case "action_held":
        return "bg-amber-950 text-amber-300 border-amber-700 font-bold";
      case "run_frozen":
        return "bg-rose-950 text-rose-200 border-rose-600 font-bold";
      case "verdict_issued":
        return "bg-cyan-950 text-cyan-300 border-cyan-700 font-bold";
      case "watcher_called":
        return "bg-purple-950 text-purple-300 border-purple-700 font-bold";
      case "restriction_applied":
        return "bg-orange-950 text-orange-300 border-orange-700 font-bold";
      case "human_action":
        return "bg-teal-950 text-teal-300 border-teal-700 font-bold";
      default:
        return "bg-zinc-900 text-zinc-300 border-zinc-700";
    }
  };

  const getCardStyle = () => {
    if (isHighlighted) return "border-rose-500 bg-[#250914] ring-1 ring-rose-500";
    switch (event.type) {
      case "action_executed":
        return "bg-[#071710] border-emerald-900/80 hover:border-emerald-700";
      case "action_blocked":
        return "bg-[#1d080f] border-rose-800/80 hover:border-rose-600";
      case "action_held":
        return "bg-[#1b1407] border-amber-800/80 hover:border-amber-600";
      case "run_frozen":
        return "bg-[#250711] border-rose-700 hover:border-rose-500";
      case "verdict_issued":
        return "bg-[#081520] border-cyan-800/80 hover:border-cyan-600";
      case "watcher_called":
        return "bg-[#140b20] border-purple-800/80 hover:border-purple-600";
      case "hard_limit_checked":
        return "bg-[#160910] border-rose-900/80 hover:border-rose-700";
      case "restriction_applied":
        return "bg-[#1c1208] border-orange-800/80 hover:border-orange-600";
      case "human_action":
        return "bg-[#0c1815] border-teal-800/80 hover:border-teal-600";
      default:
        return "bg-[#0b0d13] border-zinc-800 hover:border-zinc-700";
    }
  };

  return (
    <div
      onClick={onClick}
      id={`event-${event.id}`}
      className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors space-y-1.5 ${getCardStyle()}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-zinc-500 text-[10px]">#{event.seq}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getBadgeStyle()}`}>
            {event.type}
          </span>
          {Boolean(payload.tier) && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-cyan-400 font-semibold">
              {String(payload.tier).toUpperCase()}
            </span>
          )}
        </div>
        <span className="text-zinc-500 text-[10px] font-mono">
          {new Date(event.at).toLocaleTimeString()}
        </span>
      </div>

      {/* Payload summary */}
      <div className="text-zinc-300 text-[11px] leading-relaxed">
        {event.type === "action_proposed" && (
          <div className="space-y-0.5 font-mono">
            <span className="text-rose-400 font-bold">{String(payload.tool)}</span>
            <span className="text-zinc-400 ml-1.5">
              {JSON.stringify(payload.args || {})}
            </span>
            {Boolean(payload.rationale) && (
              <p className="text-[10px] text-zinc-500 italic mt-0.5 font-sans">
                "{String(payload.rationale)}"
              </p>
            )}
          </div>
        )}

        {event.type === "verdict_issued" && (
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white">Decision: {String(payload.decision).toUpperCase()}</span>
              <span className="text-zinc-400">({Math.round(Number(payload.confidence) * 100)}% conf)</span>
              <span className="text-purple-400">Match: {String(payload.intentMatch)}</span>
            </div>
            {Array.isArray(payload.reasons) && (
              <p className="text-zinc-400 text-[10px] font-sans">
                {payload.reasons.join("; ")}
              </p>
            )}
          </div>
        )}

        {event.type === "watcher_called" && (
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span className="text-cyan-400">Latency: {String(payload.latencyMs)} ms</span>
            <span>Tokens: {String(payload.tokensIn)} in / {String(payload.tokensOut)} out</span>
            <span className="text-purple-400">Cost: ${Number(payload.costUsd).toFixed(5)}</span>
          </div>
        )}

        {event.type === "hard_limit_checked" && (
          <div className="font-mono text-[11px]">
            <span className="text-rose-300 font-semibold">Rule: {String(payload.rule || "P1-P8")}</span>
            <span className="ml-2 text-zinc-400">{String(payload.message || "")}</span>
          </div>
        )}

        {event.type === "restriction_applied" && (
          <div className="text-orange-300 font-mono text-[10px] font-semibold">
            {JSON.stringify(payload.restriction)} (v{String(payload.version)})
          </div>
        )}

        {event.type === "action_executed" && (
          <div className="text-emerald-400 font-mono text-[11px] font-medium">
            Tool executed successfully {payload.warning ? "(with warning)" : ""}.
          </div>
        )}

        {event.type === "action_held" && (
          <div className="text-amber-400 font-mono text-[11px] font-medium">
            {String(payload.message || payload.reason || "Action held for human authorization.")}
          </div>
        )}

        {event.type === "action_blocked" && (
          <div className="text-rose-400 font-mono text-[11px] font-bold">
            {String(payload.message || payload.reason || "Action blocked.")}
          </div>
        )}

        {event.type === "run_frozen" && (
          <div className="text-rose-300 font-bold font-mono text-[11px]">
            Run frozen. Human unfreeze required.
          </div>
        )}

        {event.type === "human_action" && (
          <div className="text-zinc-200 font-mono text-[11px]">
            Action: {String(payload.action)} {payload.newVersion ? `(v${String(payload.newVersion)})` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
