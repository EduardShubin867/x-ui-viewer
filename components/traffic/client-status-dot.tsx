import type { TrafficView } from "@/lib/domain/traffic";
import { formatBitrate } from "@/lib/domain/traffic-format";
import { cn } from "@/lib/utils";

export function ClientStatusDot({ traffic, className }: { traffic?: TrafficView; className?: string }) {
  const state = !traffic ? "Метрики ещё не поступали" : traffic.stale ? "Метрики устарели" : traffic.online === true ? "В сети" : traffic.online === false ? "Не в сети" : "Online-статус недоступен";
  const details = traffic ? `${state}${traffic.onlineSource === "activity" ? " (по access log)" : ""} · ↓ ${formatBitrate(traffic.downlinkRateBps)} · ↑ ${formatBitrate(traffic.uplinkRateBps)}` : state;
  return <span title={details} aria-label={details} className={cn("inline-block size-2 shrink-0 rounded-full", !traffic ? "bg-slate-700" : traffic.stale ? "bg-amber-300" : traffic.online === true ? "bg-emerald-300 shadow-[0_0_7px_rgba(110,231,183,0.55)]" : traffic.online === false ? "bg-slate-600" : "border border-slate-500", className)} />;
}
