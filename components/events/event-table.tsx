"use client";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Clipboard, Copy, Radio } from "lucide-react";
import type { AccessEventView } from "@/lib/domain/access-event";
import { destinationLabel } from "@/lib/domain/access-event";
import { groupAccessEvents } from "@/lib/domain/event-groups";
import type { TrafficView } from "@/lib/domain/traffic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientStatusDot } from "@/components/traffic/client-status-dot";
import { IpIntelligenceCard, IpOwner } from "@/components/events/ip-intelligence";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <Button variant="ghost" size="icon" title={label} aria-label={label} onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}</Button>;
}

export function EventTable({ events, grouped, traffic }: { events: AccessEventView[]; grouped: boolean; traffic: Map<string, TrafficView> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const groups = useMemo(() => grouped ? groupAccessEvents(events) : events.map((event) => ({ id: event.eventId, representative: event, events: [event], firstAt: event.occurredAt, lastAt: event.occurredAt })), [events, grouped]);
  return <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
    <div className="overflow-x-auto"><table className="w-full min-w-[1120px] border-collapse text-left">
      <thead className="bg-slate-900/80 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="w-9 px-3 py-3" /><th className="px-3 py-3">Время</th><th className="px-3 py-3">Сервер</th><th className="px-3 py-3">Клиент</th><th className="px-3 py-3">Источник</th><th className="px-3 py-3">Назначение</th><th className="px-3 py-3">Протокол</th><th className="px-3 py-3">Маршрут</th><th className="w-20 px-3 py-3" /></tr></thead>
      <tbody className="divide-y divide-slate-900">{groups.map((group) => { const event = group.representative; const isOpen = expanded === group.id; const destination = destinationLabel(event); const duration = Math.max(0, Math.round((new Date(group.lastAt).getTime() - new Date(group.firstAt).getTime()) / 1_000)); const metric = traffic.get(`${event.nodeId}\u0000${event.clientEmail ?? ""}`); return <Fragment key={group.id}>
        <tr className="group hover:bg-slate-900/55">
          <td className="px-3 py-2.5"><button aria-label={isOpen ? "Свернуть группу" : "Развернуть группу"} onClick={() => setExpanded(isOpen ? null : group.id)} className="text-slate-600 hover:text-slate-200">{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button></td>
          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-400" title={event.occurredAt}><span>{new Date(group.lastAt).toLocaleTimeString("ru-RU")}</span>{group.events.length > 1 && <span className="mt-1 flex items-center gap-1.5"><Badge className="border-cyan-400/25 text-cyan-300">×{group.events.length}</Badge><span className="text-[10px] text-slate-600">за {duration}с</span></span>}</td>
          <td className="px-3 py-2.5 text-sm text-slate-300">{event.nodeName || event.nodeId}</td>
          <td className="px-3 py-2.5"><Link href={`/clients/${encodeURIComponent(event.nodeId)}/${encodeURIComponent(event.clientEmail ?? "unknown")}`} className="inline-flex items-center gap-2 font-mono text-xs text-cyan-300 hover:underline"><ClientStatusDot traffic={metric} />{event.clientEmail ?? "—"}</Link></td>
          <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{event.sourceIp ?? "—"}</td>
          <td className="max-w-[340px] px-3 py-2.5 font-mono text-xs font-medium text-slate-100" title={destination}><span className="block truncate">{destination}</span>{group.events.length > 1 && <span className="mt-0.5 block text-[10px] font-normal text-slate-600">{group.events.length} обращений</span>}{event.destinationIp && !event.destinationHost && !event.detectedDomain && <IpOwner ip={event.destinationIp} />}</td>
          <td className="px-3 py-2.5"><Badge className={event.network === "tcp" ? "border-cyan-400/25 text-cyan-300" : event.network === "udp" ? "border-violet-400/25 text-violet-300" : ""}>{event.network}</Badge></td>
          <td className="px-3 py-2.5 font-mono text-xs"><span className="text-slate-400">{event.inboundTag ?? "?"}</span><span className="mx-2 text-slate-700">→</span><span className="text-emerald-300/80">{event.outboundTag ?? "?"}</span></td>
          <td className="px-3 py-2.5"><div className="flex opacity-0 transition-opacity group-hover:opacity-100"><CopyButton value={destination} label="Копировать назначение" /><CopyButton value={event.rawLine} label="Копировать raw log" /></div></td>
        </tr>
        {isOpen && <tr><td colSpan={9} className="bg-slate-900/35 px-12 py-4"><div className="grid gap-4 lg:grid-cols-[1fr_2fr]"><div className="space-y-3"><dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs">{[["eventId", event.eventId], ["detectedDomain", event.detectedDomain], ["destinationHost", event.destinationHost], ["destinationIp", event.destinationIp], ["port", event.destinationPort]].map(([label, value]) => <div key={label as string}><dt className="font-mono text-[10px] uppercase text-slate-600">{label}</dt><dd className="mt-0.5 break-all font-mono text-slate-300">{value ?? "—"}</dd></div>)}</dl>{event.destinationIp && !event.destinationHost && !event.detectedDomain && <IpIntelligenceCard ip={event.destinationIp} />}</div><div><div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase text-slate-600"><Clipboard className="size-3" />{group.events.length > 1 ? `Исходные события · ${group.events.length}` : "Raw access log"}</div>{group.events.length === 1 ? <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-400">{event.rawLine}</pre> : <div className="max-h-80 divide-y divide-slate-800 overflow-y-auto rounded border border-slate-800 bg-slate-950">{group.events.map((item) => <div key={item.eventId} className="grid grid-cols-[80px_120px_1fr] gap-3 px-3 py-2 font-mono text-[11px]"><span className="text-slate-500">{new Date(item.occurredAt).toLocaleTimeString("ru-RU")}</span><span className="truncate text-slate-600">{item.sourceIp ?? "—"}</span><span className="break-all text-slate-400">{item.rawLine}</span></div>)}</div>}</div></div></td></tr>}
      </Fragment>; })}</tbody>
    </table></div>
    {!events.length && <div className="grid min-h-48 place-items-center border-t border-slate-900 text-center"><div><Radio className="mx-auto mb-3 size-6 text-slate-700" /><p className="text-sm text-slate-400">Событий пока нет</p><p className="mt-1 text-xs text-slate-600">Проверьте collector или измените фильтры</p></div></div>}
  </div>;
}
