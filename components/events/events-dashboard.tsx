"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, Clipboard, Copy, Pause, Play, Radio, RefreshCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { EventsPage, XrayAccessEvent } from "@/lib/domain/access-event";
import { destinationLabel } from "@/lib/domain/access-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface NodeItem { id: string; name: string; slug: string; lastSyncAt: string | null; syncError: string | null }
interface ClientItem { email: string; nodeId: string; nodeName: string; inboundTag: string | null }
interface Stats { total: number; topDomains: { label: string; value: number }[]; topClients: { label: string; value: number }[]; topOutbounds: { label: string; value: number }[]; perMinute: { label: string; value: number }[]; unknownDomain: number; uniqueDestinations: number }
const json = async <T,>(url: string): Promise<T> => { const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<T>; };

function matches(event: XrayAccessEvent, filters: Record<string, string>): boolean {
  const haystack = [event.clientEmail, event.destinationHost, event.destinationIp, event.detectedDomain, event.inboundTag, event.outboundTag].filter(Boolean).join(" ").toLowerCase();
  return (!filters.nodeId || event.nodeId === filters.nodeId) && (!filters.clientEmail || event.clientEmail === filters.clientEmail) && (!filters.network || event.network === filters.network) && (!filters.inboundTag || event.inboundTag === filters.inboundTag) && (!filters.outboundTag || event.outboundTag === filters.outboundTag) && (!filters.search || haystack.includes(filters.search.toLowerCase()));
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="ghost" size="icon" title={label} aria-label={label} onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}</Button>;
}

export function EventsDashboard({ fixed }: { fixed?: { nodeId: string; clientEmail: string; from: string } }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({ nodeId: fixed?.nodeId ?? "", clientEmail: fixed?.clientEmail ?? "", network: "", inboundTag: "", outboundTag: "", search: "", from: fixed?.from ?? "", period: "" });
  const [live, setLive] = useState(true);
  const [connected, setConnected] = useState(false);
  const [rowLimit, setRowLimit] = useState("250");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<XrayAccessEvent[]>([]);
  const filterRef = useRef(filters);
  const liveRef = useRef(live);
  useEffect(() => { filterRef.current = filters; }, [filters]);
  useEffect(() => { liveRef.current = live; }, [live]);

  const params = useMemo(() => {
    const search = new URLSearchParams({ limit: rowLimit });
    for (const [key, value] of Object.entries(filters)) if (value && key !== "period") search.set(key, value);
    return search.toString();
  }, [filters, rowLimit]);
  const eventsQuery = useQuery({ queryKey: ["events", params], queryFn: () => json<EventsPage>(`/api/events?${params}`) });
  const nodesQuery = useQuery({ queryKey: ["nodes"], queryFn: () => json<{ items: NodeItem[] }>("/api/nodes") });
  const clientsQuery = useQuery({ queryKey: ["clients", filters.nodeId], queryFn: () => json<{ items: ClientItem[] }>(`/api/clients${filters.nodeId ? `?nodeId=${encodeURIComponent(filters.nodeId)}` : ""}`) });
  const statsParams = new URLSearchParams({ minutes: filters.period || "60" });
  if (filters.nodeId) statsParams.set("nodeId", filters.nodeId);
  if (filters.clientEmail) statsParams.set("clientEmail", filters.clientEmail);
  const statsQuery = useQuery({ queryKey: ["stats", statsParams.toString()], queryFn: () => json<Stats>(`/api/stats?${statsParams}`), enabled: !fixed, refetchInterval: live ? 15_000 : false });

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    source.addEventListener("ready", () => { setConnected(true); void queryClient.invalidateQueries({ queryKey: ["events"] }); });
    source.addEventListener("access-event", (message) => {
      const event = JSON.parse((message as MessageEvent<string>).data) as XrayAccessEvent;
      if (!matches(event, filterRef.current)) return;
      if (!liveRef.current) { setPending((current) => [...current.slice(-499), event]); return; }
      queryClient.setQueriesData<EventsPage>({ queryKey: ["events"] }, (current) => current ? { ...current, items: [{ ...event, id: `live-${event.eventId}`, nodeName: event.nodeId }, ...current.items.filter((item) => item.eventId !== event.eventId)].slice(0, Number(rowLimit)) } : current);
    });
    source.addEventListener("resync-required", () => void queryClient.invalidateQueries({ queryKey: ["events"] }));
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [queryClient, rowLimit]);

  const update = (key: string) => (value: string) => setFilters((current) => ({ ...current, [key]: value, ...(key === "nodeId" ? { clientEmail: "" } : {}) }));
  const updatePeriod = (value: string) => setFilters((current) => ({ ...current, period: value, from: value ? new Date(Date.now() - Number(value) * 60_000).toISOString() : "" }));
  const events = eventsQuery.data?.items ?? [];
  const inbounds = [...new Set(events.map((event) => event.inboundTag).filter((value): value is string => Boolean(value)))];
  const outbounds = [...new Set(events.map((event) => event.outboundTag).filter((value): value is string => Boolean(value)))];
  const clear = () => setFilters({ nodeId: fixed?.nodeId ?? "", clientEmail: fixed?.clientEmail ?? "", from: fixed?.from ?? "", period: "", network: "", inboundTag: "", outboundTag: "", search: "" });
  const resume = () => {
    setLive(true);
    if (pending.length) { setPending([]); void queryClient.invalidateQueries({ queryKey: ["events"] }); }
  };

  return <section className="space-y-4">
    {!fixed && <div className="flex items-end justify-between gap-6">
      <div><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">Live access telemetry</p><h1 className="text-2xl font-semibold tracking-tight text-white">Подключения в реальном времени</h1></div>
      <div className="flex items-center gap-3 text-xs text-slate-500"><span>{events.length} строк в браузере</span><span className="h-4 w-px bg-slate-800" /><span>лимит</span><Select value={rowLimit} onValueChange={setRowLimit} placeholder="250" options={["100", "250", "500"].map((value) => ({ value, label: value }))} className="min-w-20" /></div>
    </div>}

    {!fixed && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Соединения · час</p><p className="mt-1 text-xl font-semibold text-white">{statsQuery.data?.total ?? 0}</p><div className="mt-2 flex h-5 items-end gap-px">{(statsQuery.data?.perMinute ?? []).slice(-30).map((item) => { const max = Math.max(...(statsQuery.data?.perMinute ?? []).map((point) => point.value), 1); return <span key={item.label} className="min-w-0 flex-1 bg-cyan-300/55" style={{ height: `${Math.max(12, item.value / max * 100)}%` }} />; })}</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Уникальные назначения</p><p className="mt-1 text-xl font-semibold text-white">{statsQuery.data?.uniqueDestinations ?? 0}</p><p className="mt-2 truncate text-xs text-slate-500">за выбранный период</p></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Без домена</p><p className="mt-1 text-xl font-semibold text-amber-200">{statsQuery.data?.unknownDomain ?? 0}</p><p className="mt-2 truncate text-xs text-slate-500">только destination IP</p></div>
      {[{ label: "Топ домен", item: statsQuery.data?.topDomains[0] }, { label: "Топ клиент", item: statsQuery.data?.topClients[0] }, { label: "Топ outbound", item: statsQuery.data?.topOutbounds[0] }].map(({ label, item }) => <div key={label} className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-2 truncate font-mono text-sm text-cyan-200" title={item?.label}>{item?.label ?? "—"}</p><p className="mt-2 text-xs text-slate-600">{item ? `${item.value} событий` : "нет данных"}</p></div>)}
    </div>}

    <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-[1fr_1fr_105px_1fr_1fr_120px_1.4fr_auto_auto]">
        <Select value={filters.nodeId} onValueChange={update("nodeId")} placeholder="Все серверы" disabled={Boolean(fixed)} options={(nodesQuery.data?.items ?? []).map((node) => ({ value: node.slug, label: node.name }))} />
        <Select value={filters.clientEmail} onValueChange={update("clientEmail")} placeholder="Все клиенты" disabled={Boolean(fixed)} options={(clientsQuery.data?.items ?? []).map((client) => ({ value: client.email, label: client.email }))} />
        <Select value={filters.network} onValueChange={update("network")} placeholder="TCP / UDP" options={[{ value: "tcp", label: "TCP" }, { value: "udp", label: "UDP" }]} />
        <Select value={filters.inboundTag} onValueChange={update("inboundTag")} placeholder="Inbound" options={inbounds.map((value) => ({ value, label: value }))} />
        <Select value={filters.outboundTag} onValueChange={update("outboundTag")} placeholder="Outbound" options={outbounds.map((value) => ({ value, label: value }))} />
        <Select value={filters.period} onValueChange={updatePeriod} placeholder="Весь период" options={[{ value: "5", label: "5 минут" }, { value: "60", label: "1 час" }, { value: "360", label: "6 часов" }, { value: "1440", label: "24 часа" }]} />
        <label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-600" /><Input value={filters.search} onChange={(event) => update("search")(event.target.value)} className="pl-9" placeholder="Домен, IP, email или tag" /></label>
        <Button variant="ghost" size="icon" onClick={clear} title="Очистить фильтры"><X className="size-4" /></Button>
        {live ? <Button variant="secondary" onClick={() => setLive(false)}><Pause className="size-3.5" />Пауза</Button> : <Button onClick={resume}><Play className="size-3.5" />Продолжить {pending.length ? `+${pending.length}` : ""}</Button>}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
        <span className="flex items-center gap-2 text-slate-500"><Radio className={`size-3.5 ${connected && live ? "text-emerald-300" : "text-amber-300"}`} /><span className={connected && live ? "text-emerald-300" : "text-amber-300"}>{connected ? (live ? "LIVE · автообновление включено" : "LIVE · отображение приостановлено") : "Переподключение…"}</span>{filters.nodeId && <span className="ml-3 border-l border-slate-800 pl-3">{nodesQuery.data?.items.find((node) => node.slug === filters.nodeId)?.syncError ? <span className="text-rose-300">sync error: {nodesQuery.data.items.find((node) => node.slug === filters.nodeId)?.syncError}</span> : <span>sync: {nodesQuery.data?.items.find((node) => node.slug === filters.nodeId)?.lastSyncAt ? new Date(nodesQuery.data.items.find((node) => node.slug === filters.nodeId)!.lastSyncAt!).toLocaleString("ru-RU") : "ещё не выполнялся"}</span>}</span>}</span>
        <Button variant="ghost" size="sm" onClick={() => void eventsQuery.refetch()}><RefreshCcw className={`size-3 ${eventsQuery.isFetching ? "animate-spin" : ""}`} />Обновить</Button>
      </div>
    </div>

    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead className="bg-slate-900/80 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="w-9 px-3 py-3" /><th className="px-3 py-3">Время</th><th className="px-3 py-3">Сервер</th><th className="px-3 py-3">Клиент</th><th className="px-3 py-3">Источник</th><th className="px-3 py-3">Назначение</th><th className="px-3 py-3">Протокол</th><th className="px-3 py-3">Маршрут</th><th className="w-20 px-3 py-3" /></tr></thead>
          <tbody className="divide-y divide-slate-900">
            {events.map((event) => { const isOpen = expanded === event.eventId; const destination = destinationLabel(event); return <Fragment key={event.eventId}>
              <tr className="group hover:bg-slate-900/55">
                <td className="px-3 py-2.5"><button onClick={() => setExpanded(isOpen ? null : event.eventId)} className="text-slate-600 hover:text-slate-200">{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button></td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-400" title={event.occurredAt}>{new Date(event.occurredAt).toLocaleTimeString("ru-RU")}</td>
                <td className="px-3 py-2.5 text-sm text-slate-300">{event.nodeName || event.nodeId}</td>
                <td className="px-3 py-2.5"><Link href={`/clients/${encodeURIComponent(event.nodeId)}/${encodeURIComponent(event.clientEmail ?? "unknown")}`} className="font-mono text-xs text-cyan-300 hover:underline">{event.clientEmail ?? "—"}</Link></td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{event.sourceIp ?? "—"}</td>
                <td className="max-w-[340px] truncate px-3 py-2.5 font-mono text-xs font-medium text-slate-100" title={destination}>{destination}</td>
                <td className="px-3 py-2.5"><Badge className={event.network === "tcp" ? "border-cyan-400/25 text-cyan-300" : event.network === "udp" ? "border-violet-400/25 text-violet-300" : ""}>{event.network}</Badge></td>
                <td className="px-3 py-2.5 font-mono text-xs"><span className="text-slate-400">{event.inboundTag ?? "?"}</span><span className="mx-2 text-slate-700">→</span><span className="text-emerald-300/80">{event.outboundTag ?? "?"}</span></td>
                <td className="px-3 py-2.5"><div className="flex opacity-0 transition-opacity group-hover:opacity-100"><CopyButton value={destination} label="Копировать назначение" /><CopyButton value={event.rawLine} label="Копировать raw log" /></div></td>
              </tr>
              {isOpen && <tr><td colSpan={9} className="bg-slate-900/35 px-12 py-4"><div className="grid gap-4 lg:grid-cols-[1fr_2fr]"><dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs">{[["eventId", event.eventId], ["detectedDomain", event.detectedDomain], ["destinationHost", event.destinationHost], ["destinationIp", event.destinationIp], ["port", event.destinationPort]].map(([label, value]) => <div key={label as string}><dt className="font-mono text-[10px] uppercase text-slate-600">{label}</dt><dd className="mt-0.5 break-all font-mono text-slate-300">{value ?? "—"}</dd></div>)}</dl><div><div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase text-slate-600"><Clipboard className="size-3" />Raw access log</div><pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-400">{event.rawLine}</pre></div></div></td></tr>}
            </Fragment>; })}
          </tbody>
        </table>
      </div>
      {!events.length && <div className="grid min-h-48 place-items-center border-t border-slate-900 text-center"><div><Radio className="mx-auto mb-3 size-6 text-slate-700" /><p className="text-sm text-slate-400">Событий пока нет</p><p className="mt-1 text-xs text-slate-600">Проверьте collector или измените фильтры</p></div></div>}
    </div>
  </section>;
}
