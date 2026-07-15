"use client";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Globe2, MapPin, Network } from "lucide-react";
import type { EventsPage } from "@/lib/domain/access-event";
import type { TrafficView } from "@/lib/domain/traffic";
import { formatBitrate, formatBytes } from "@/lib/domain/traffic-format";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/stats/metric-card";
import { RankList } from "@/components/stats/rank-list";
import { ClientStatusDot } from "@/components/traffic/client-status-dot";
import { AiAnalysisDrawer } from "@/components/events/ai-analysis-drawer";

interface Stats { total: number; topDomains: { label: string; value: number }[]; topOutbounds: { label: string; value: number }[]; networks: { label: string; value: number }[]; unknownDomain: number; uniqueDestinations: number; ipOnly: { destinationIp: string | null; occurredAt: string }[]; lastSourceIp: string | null; lastActivity: string | null }
const get = async <T,>(url: string) => (await fetch(url)).json() as Promise<T>;

export function ClientDashboard({ nodeId, email }: { nodeId: string; email: string }) {
  const prefix = `nodeId=${encodeURIComponent(nodeId)}&clientEmail=${encodeURIComponent(email)}`;
  const recent = useQuery({ queryKey: ["client-events", nodeId, email], queryFn: () => get<EventsPage>(`/api/events?${prefix}&limit=50`) });
  const five = useQuery({ queryKey: ["client-stats", nodeId, email, 5], queryFn: () => get<Stats>(`/api/stats?${prefix}&minutes=5`) });
  const hour = useQuery({ queryKey: ["client-stats", nodeId, email, 60], queryFn: () => get<Stats>(`/api/stats?${prefix}&minutes=60`) });
  const traffic = useQuery({ queryKey: ["client-traffic", nodeId, email], queryFn: () => get<{ items: TrafficView[] }>(`/api/traffic?nodeId=${encodeURIComponent(nodeId)}&email=${encodeURIComponent(email)}`), refetchInterval: 15_000 });
  const stats = hour.data;
  const metric = traffic.data?.items[0];
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">Client activity profile</p><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight text-white">{email}</h1><Badge>{nodeId}</Badge><span className="inline-flex items-center gap-2 text-xs text-slate-400"><ClientStatusDot traffic={metric} />{!metric ? "нет метрик" : metric.stale ? "метрики устарели" : metric.online === true ? "online" : metric.online === false ? "offline" : "online неизвестен"}</span></div></div><AiAnalysisDrawer scope={{ nodeId, clientEmails: [email], minutes: 60, includeLoopback: false }} /></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <MetricCard label="Скачано всего" value={metric ? formatBytes(metric.downlinkBytes) : "—"} detail="с запуска Xray" />
      <MetricCard label="Отдано всего" value={metric ? formatBytes(metric.uplinkBytes) : "—"} detail="с запуска Xray" />
      <MetricCard label="Сейчас ↓ / ↑" value={metric && !metric.stale ? `${formatBitrate(metric.downlinkRateBps)} / ${formatBitrate(metric.uplinkRateBps)}` : "—"} detail={metric?.stale ? "метрики устарели" : "последний интервал"} />
      <MetricCard label="Последняя активность" value={stats?.lastActivity ? new Date(stats.lastActivity).toLocaleTimeString("ru-RU") : "—"} detail={stats?.lastActivity ? new Date(stats.lastActivity).toLocaleDateString("ru-RU") : "Событий нет"} />
      <MetricCard label="Source IP" value={stats?.lastSourceIp ?? "—"} detail="последний известный" />
      <MetricCard label="Уникальные назначения" value={stats?.uniqueDestinations ?? 0} detail="за последний час" />
    </div>
    <div className="grid gap-4 xl:grid-cols-4"><RankList title="Топ доменов · 5 минут" items={five.data?.topDomains ?? []} /><RankList title="Топ доменов · 1 час" items={hour.data?.topDomains ?? []} /><RankList title="Outbound · 1 час" items={hour.data?.topOutbounds ?? []} /><RankList title="TCP / UDP · 1 час" items={hour.data?.networks ?? []} /></div>
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <div className="overflow-hidden rounded-lg border border-slate-800"><div className="border-b border-slate-800 bg-slate-900/60 px-4 py-3 text-sm font-medium">Последние обращения</div><div className="divide-y divide-slate-900">{(recent.data?.items ?? []).map((event) => <div key={event.eventId} className="grid grid-cols-[90px_1fr_auto] items-center gap-4 px-4 py-3 text-xs hover:bg-slate-900/40"><span className="font-mono text-slate-600">{new Date(event.occurredAt).toLocaleTimeString("ru-RU")}</span><span className="truncate font-mono text-slate-300">{event.detectedDomain ?? event.destinationHost ?? event.destinationIp ?? "unknown"}:{event.destinationPort ?? "?"}</span><Badge className={event.network === "tcp" ? "text-cyan-300" : "text-violet-300"}>{event.network}</Badge></div>)}</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-4"><h3 className="mb-4 flex items-center gap-2 text-sm font-medium"><Globe2 className="size-4 text-amber-300" />События только с IP</h3><div className="space-y-2">{(stats?.ipOnly ?? []).map((event, index) => <div key={`${event.destinationIp}-${index}`} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs"><span className="flex items-center gap-2 text-slate-300"><MapPin className="size-3 text-slate-600" />{event.destinationIp}</span><span className="text-slate-600">{new Date(event.occurredAt).toLocaleTimeString("ru-RU")}</span></div>)}</div>{!stats?.ipOnly.length && <div className="grid h-32 place-items-center text-xs text-slate-600"><span className="flex items-center gap-2"><Network className="size-4" />Нет таких событий</span></div>}</div>
    </div>
    <p className="flex items-center gap-2 text-xs text-slate-600"><Clock3 className="size-3.5" />Байты и скорость берутся из Xray Metrics; распределить объём по отдельным доменам access log не позволяет.</p>
  </section>;
}
