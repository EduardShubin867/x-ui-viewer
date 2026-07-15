"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Layers2, List, Pause, Play, Radio, RefreshCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EventsPage, XrayAccessEvent } from "@/lib/domain/access-event";
import type { TrafficView } from "@/lib/domain/traffic";
import { formatBitrate } from "@/lib/domain/traffic-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { AiAnalysisDrawer } from "@/components/events/ai-analysis-drawer";
import { EventTable } from "@/components/events/event-table";

interface NodeItem { id: string; name: string; slug: string; lastSyncAt: string | null; syncError: string | null }
interface ClientItem { email: string; nodeId: string; nodeName: string; inboundTag: string | null }
interface Stats { total: number; topDomains: { label: string; value: number }[]; topClients: { label: string; value: number }[]; topOutbounds: { label: string; value: number }[]; perMinute: { label: string; value: number }[]; unknownDomain: number; uniqueDestinations: number }
const json = async <T,>(url: string): Promise<T> => { const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<T>; };

function matches(event: XrayAccessEvent, filters: Record<string, string>, clientEmails: readonly string[], includeLoopback: boolean): boolean {
  const haystack = [event.clientEmail, event.destinationHost, event.destinationIp, event.detectedDomain, event.inboundTag, event.outboundTag].filter(Boolean).join(" ").toLowerCase();
  return (includeLoopback || event.destinationIp !== "127.0.0.1") && (!filters.nodeId || event.nodeId === filters.nodeId) && (!clientEmails.length || Boolean(event.clientEmail && clientEmails.includes(event.clientEmail))) && (!filters.network || event.network === filters.network) && (!filters.inboundTag || event.inboundTag === filters.inboundTag) && (!filters.outboundTag || event.outboundTag === filters.outboundTag) && (!filters.search || haystack.includes(filters.search.toLowerCase()));
}

export function EventsDashboard({ fixed }: { fixed?: { nodeId: string; clientEmail: string; from: string } }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({ nodeId: fixed?.nodeId ?? "", network: "", inboundTag: "", outboundTag: "", search: "", from: fixed?.from ?? "", period: "" });
  const [clientEmails, setClientEmails] = useState<string[]>(fixed?.clientEmail ? [fixed.clientEmail] : []);
  const [includeLoopback, setIncludeLoopback] = useState(false);
  const [live, setLive] = useState(true);
  const [connected, setConnected] = useState(false);
  const [rowLimit, setRowLimit] = useState("250");
  const [grouped, setGrouped] = useState(true);
  const [pending, setPending] = useState<XrayAccessEvent[]>([]);
  const filterRef = useRef(filters);
  const clientEmailsRef = useRef(clientEmails);
  const includeLoopbackRef = useRef(includeLoopback);
  const liveRef = useRef(live);
  useEffect(() => { filterRef.current = filters; }, [filters]);
  useEffect(() => { clientEmailsRef.current = clientEmails; }, [clientEmails]);
  useEffect(() => { includeLoopbackRef.current = includeLoopback; }, [includeLoopback]);
  useEffect(() => { liveRef.current = live; }, [live]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = localStorage.getItem("xray-scope:group-repeats");
      if (saved !== null) setGrouped(saved === "true");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const params = useMemo(() => {
    const search = new URLSearchParams({ limit: rowLimit });
    for (const [key, value] of Object.entries(filters)) if (value && key !== "period") search.set(key, value);
    for (const email of clientEmails) search.append("clientEmail", email);
    if (includeLoopback) search.set("includeLoopback", "true");
    return search.toString();
  }, [clientEmails, filters, includeLoopback, rowLimit]);
  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; }, [params]);
  const eventsQuery = useQuery({ queryKey: ["events", params], queryFn: () => json<EventsPage>(`/api/events?${params}`) });
  const nodesQuery = useQuery({ queryKey: ["nodes"], queryFn: () => json<{ items: NodeItem[] }>("/api/nodes") });
  const clientsQuery = useQuery({ queryKey: ["clients", filters.nodeId], queryFn: () => json<{ items: ClientItem[] }>(`/api/clients${filters.nodeId ? `?nodeId=${encodeURIComponent(filters.nodeId)}` : ""}`) });
  const trafficQuery = useQuery({ queryKey: ["traffic", filters.nodeId], queryFn: () => json<{ items: TrafficView[] }>(`/api/traffic${filters.nodeId ? `?nodeId=${encodeURIComponent(filters.nodeId)}` : ""}`), refetchInterval: live ? 15_000 : false });
  const statsParams = new URLSearchParams({ minutes: filters.period || "60" });
  if (filters.nodeId) statsParams.set("nodeId", filters.nodeId);
  for (const email of clientEmails) statsParams.append("clientEmail", email);
  if (includeLoopback) statsParams.set("includeLoopback", "true");
  const statsQuery = useQuery({ queryKey: ["stats", statsParams.toString()], queryFn: () => json<Stats>(`/api/stats?${statsParams}`), enabled: !fixed, refetchInterval: live ? 15_000 : false });

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    source.addEventListener("ready", () => { setConnected(true); void queryClient.invalidateQueries({ queryKey: ["events"] }); });
    source.addEventListener("access-event", (message) => {
      const event = JSON.parse((message as MessageEvent<string>).data) as XrayAccessEvent;
      if (!matches(event, filterRef.current, clientEmailsRef.current, includeLoopbackRef.current)) return;
      if (!liveRef.current) { setPending((current) => [...current.slice(-499), event]); return; }
      queryClient.setQueryData<EventsPage>(["events", paramsRef.current], (current) => current ? { ...current, items: [{ ...event, id: `live-${event.eventId}`, nodeName: event.nodeId }, ...current.items.filter((item) => item.eventId !== event.eventId)].slice(0, Number(rowLimit)) } : current);
    });
    source.addEventListener("resync-required", () => void queryClient.invalidateQueries({ queryKey: ["events"] }));
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [queryClient, rowLimit]);

  const update = (key: string) => (value: string) => {
    if (key === "nodeId") { setClientEmails([]); setPending([]); }
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const updatePeriod = (value: string) => setFilters((current) => ({ ...current, period: value, from: value ? new Date(Date.now() - Number(value) * 60_000).toISOString() : "" }));
  const events = eventsQuery.data?.items ?? [];
  const trafficMap = useMemo(() => new Map((trafficQuery.data?.items ?? []).map((item) => [`${item.nodeId}\u0000${item.email}`, item])), [trafficQuery.data?.items]);
  const scopedTraffic = useMemo(() => (trafficQuery.data?.items ?? []).filter((item) => (!clientEmails.length || clientEmails.includes(item.email)) && (!filters.nodeId || item.nodeId === filters.nodeId)), [clientEmails, filters.nodeId, trafficQuery.data?.items]);
  const freshTraffic = scopedTraffic.filter((item) => !item.stale);
  const onlineCount = freshTraffic.filter((item) => item.online === true).length;
  const downlinkRate = scopedTraffic.reduce((sum, item) => sum + Number(item.downlinkRateBps), 0);
  const uplinkRate = scopedTraffic.reduce((sum, item) => sum + Number(item.uplinkRateBps), 0);
  const clientOptions = useMemo(() => {
    const clients = new Map<string, Set<string>>();
    for (const client of clientsQuery.data?.items ?? []) {
      const nodes = clients.get(client.email) ?? new Set<string>();
      nodes.add(client.nodeName);
      clients.set(client.email, nodes);
    }
    return [...clients].map(([email, nodes]) => {
      const samples = (trafficQuery.data?.items ?? []).filter((item) => item.email === email && (!filters.nodeId || item.nodeId === filters.nodeId));
      const status = samples.some((item) => !item.stale && item.online === true) ? "● online" : samples.some((item) => item.stale) ? "● метрики устарели" : samples.length ? "○ offline" : "? нет метрик";
      const rates = samples.length ? `↓ ${formatBitrate(samples.reduce((sum, item) => sum + Number(item.downlinkRateBps), 0))} · ↑ ${formatBitrate(samples.reduce((sum, item) => sum + Number(item.uplinkRateBps), 0))}` : "";
      return { value: email, label: email, description: [filters.nodeId ? "" : [...nodes].join(" · "), status, rates].filter(Boolean).join(" · ") };
    });
  }, [clientsQuery.data?.items, filters.nodeId, trafficQuery.data?.items]);
  const inbounds = [...new Set(events.map((event) => event.inboundTag).filter((value): value is string => Boolean(value)))];
  const outbounds = [...new Set(events.map((event) => event.outboundTag).filter((value): value is string => Boolean(value)))];
  const clear = () => { setClientEmails(fixed?.clientEmail ? [fixed.clientEmail] : []); setIncludeLoopback(false); setPending([]); setFilters({ nodeId: fixed?.nodeId ?? "", from: fixed?.from ?? "", period: "", network: "", inboundTag: "", outboundTag: "", search: "" }); };
  const resume = () => {
    setLive(true);
    if (pending.length) { setPending([]); void queryClient.invalidateQueries({ queryKey: ["events"] }); }
  };

  return <section className="space-y-4">
    {!fixed && <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end sm:gap-6">
      <div><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">Live access telemetry</p><h1 className="text-2xl font-semibold tracking-tight text-white">Подключения в реальном времени</h1></div>
      <div className="flex w-full flex-wrap items-center gap-3 text-xs text-slate-500 sm:w-auto"><span>{events.length} строк в браузере</span><span className="h-4 w-px bg-slate-800" /><span>лимит</span><Select value={rowLimit} onValueChange={setRowLimit} placeholder="250" options={["100", "250", "500"].map((value) => ({ value, label: value }))} className="min-w-20" /></div>
    </div>}

    {!fixed && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Соединения · час</p><p className="mt-1 text-xl font-semibold text-white">{statsQuery.data?.total ?? 0}</p><div className="mt-2 flex h-5 items-end gap-px">{(statsQuery.data?.perMinute ?? []).slice(-30).map((item) => { const max = Math.max(...(statsQuery.data?.perMinute ?? []).map((point) => point.value), 1); return <span key={item.label} className="min-w-0 flex-1 bg-cyan-300/55" style={{ height: `${Math.max(12, item.value / max * 100)}%` }} />; })}</div></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Уникальные назначения</p><p className="mt-1 text-xl font-semibold text-white">{statsQuery.data?.uniqueDestinations ?? 0}</p><p className="mt-2 truncate text-xs text-slate-500">за выбранный период</p></div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Без домена</p><p className="mt-1 text-xl font-semibold text-amber-200">{statsQuery.data?.unknownDomain ?? 0}</p><p className="mt-2 truncate text-xs text-slate-500">владелец определяется по RDAP</p></div>
      {[{ label: "Топ домен", item: statsQuery.data?.topDomains[0] }, { label: "Топ клиент", item: statsQuery.data?.topClients[0] }, { label: "Топ outbound", item: statsQuery.data?.topOutbounds[0] }].map(({ label, item }) => <div key={label} className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-2 truncate font-mono text-sm text-cyan-200" title={item?.label}>{item?.label ?? "—"}</p><p className="mt-2 text-xs text-slate-600">{item ? `${item.value} событий` : "нет данных"}</p></div>)}
    </div>}

    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/45 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-[minmax(150px,1fr)_minmax(160px,1fr)_120px_minmax(135px,1fr)_minmax(135px,1fr)_130px_minmax(220px,1.4fr)_36px_auto]">
        <Select value={filters.nodeId} onValueChange={update("nodeId")} placeholder="Все серверы" disabled={Boolean(fixed)} options={(nodesQuery.data?.items ?? []).map((node) => ({ value: node.slug, label: node.name }))} />
        <MultiSelect value={clientEmails} onValueChange={(value) => { setClientEmails(value); setPending([]); }} placeholder="Все клиенты" disabled={Boolean(fixed)} loading={clientsQuery.isLoading} options={clientOptions} />
        <Select value={filters.network} onValueChange={update("network")} placeholder="TCP / UDP" options={[{ value: "tcp", label: "TCP" }, { value: "udp", label: "UDP" }]} />
        <Select value={filters.inboundTag} onValueChange={update("inboundTag")} placeholder="Inbound" options={inbounds.map((value) => ({ value, label: value }))} />
        <Select value={filters.outboundTag} onValueChange={update("outboundTag")} placeholder="Outbound" options={outbounds.map((value) => ({ value, label: value }))} />
        <Select value={filters.period} onValueChange={updatePeriod} placeholder="Весь период" options={[{ value: "5", label: "5 минут" }, { value: "60", label: "1 час" }, { value: "360", label: "6 часов" }, { value: "1440", label: "24 часа" }]} />
        <label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-600" /><Input value={filters.search} onChange={(event) => update("search")(event.target.value)} className="pl-9" placeholder="Домен, IP, email или tag" /></label>
        <Button variant="ghost" size="icon" onClick={clear} title="Очистить фильтры"><X className="size-4" /></Button>
        {live ? <Button variant="secondary" onClick={() => setLive(false)}><Pause className="size-3.5" />Пауза</Button> : <Button onClick={resume}><Play className="size-3.5" />Продолжить {pending.length ? `+${pending.length}` : ""}</Button>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-xs">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-slate-500"><Radio className={`size-3.5 ${connected && live ? "text-emerald-300" : "text-amber-300"}`} /><span className={connected && live ? "text-emerald-300" : "text-amber-300"}>{connected ? (live ? "LIVE · автообновление включено" : "LIVE · отображение приостановлено") : "Переподключение…"}</span><Button variant="ghost" size="sm" aria-pressed={includeLoopback} title={includeLoopback ? "Скрыть подключения к 127.0.0.1" : "Показать подключения к 127.0.0.1"} onClick={() => { setIncludeLoopback((current) => !current); setPending([]); }} className={includeLoopback ? "text-cyan-300" : "text-slate-500"}>{includeLoopback ? <Eye className="size-3" /> : <EyeOff className="size-3" />}127.0.0.1</Button>{filters.nodeId && <span className="border-l border-slate-800 pl-3">{nodesQuery.data?.items.find((node) => node.slug === filters.nodeId)?.syncError ? <span className="text-rose-300">sync error: {nodesQuery.data.items.find((node) => node.slug === filters.nodeId)?.syncError}</span> : <span>sync: {nodesQuery.data?.items.find((node) => node.slug === filters.nodeId)?.lastSyncAt ? new Date(nodesQuery.data.items.find((node) => node.slug === filters.nodeId)!.lastSyncAt!).toLocaleString("ru-RU") : "ещё не выполнялся"}</span>}</span>}</span>
        <Button variant="ghost" size="sm" onClick={() => void eventsQuery.refetch()}><RefreshCcw className={`size-3 ${eventsQuery.isFetching ? "animate-spin" : ""}`} />Обновить</Button>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/35 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-400">
        <span><span className={onlineCount ? "text-emerald-300" : "text-slate-600"}>●</span> Онлайн <b className="font-mono font-medium text-slate-200">{onlineCount}/{scopedTraffic.length || "—"}</b></span>
        <span>↓ <b className="font-mono font-medium text-cyan-200">{formatBitrate(downlinkRate)}</b></span>
        <span>↑ <b className="font-mono font-medium text-violet-200">{formatBitrate(uplinkRate)}</b></span>
        {!scopedTraffic.length && <span className="text-amber-300/70">Метрики Xray ещё не поступали</span>}
        {scopedTraffic.length > 0 && freshTraffic.length === 0 && <span className="text-amber-300/70">Метрики устарели</span>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" aria-pressed={grouped} onClick={() => { setGrouped((current) => { localStorage.setItem("xray-scope:group-repeats", String(!current)); return !current; }); }} className={grouped ? "text-cyan-300" : "text-slate-500"}>{grouped ? <Layers2 className="size-3.5" /> : <List className="size-3.5" />}Повторы: {grouped ? "сгруппированы" : "все строки"}</Button>
        <AiAnalysisDrawer scope={{ nodeId: filters.nodeId || undefined, clientEmails, minutes: Number(filters.period || 60), includeLoopback }} />
      </div>
    </div>
    <EventTable events={events} grouped={grouped} traffic={trafficMap} />
  </section>;
}
