"use client";
import { useQuery } from "@tanstack/react-query";
import { Building2, ExternalLink, Globe2, Network } from "lucide-react";
import type { IpIntelligence as IpIntelligenceData } from "@/lib/domain/ip-intelligence";

async function loadIpIntelligence(ip: string): Promise<IpIntelligenceData> {
  const response = await fetch(`/api/ip-info?ip=${encodeURIComponent(ip)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<IpIntelligenceData>;
}

function useIpIntelligence(ip: string) {
  return useQuery({
    queryKey: ["ip-intelligence", ip],
    queryFn: () => loadIpIntelligence(ip),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

export function IpOwner({ ip }: { ip: string }) {
  const query = useIpIntelligence(ip);
  if (query.isPending)
    return (
      <span className="block truncate text-[10px] font-normal text-slate-600">
        определяем владельца…
      </span>
    );
  if (!query.data)
    return (
      <span className="block truncate text-[10px] font-normal text-slate-600">
        владелец не определён
      </span>
    );
  return (
    <span
      className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-normal text-amber-200/80"
      title={[query.data.owner, query.data.networkName, query.data.country]
        .filter(Boolean)
        .join(" · ")}
    >
      <Building2 className="size-2.5 shrink-0" />
      {query.data.owner}
      {query.data.country ? ` · ${query.data.country}` : ""}
    </span>
  );
}

export function IpIntelligenceCard({ ip }: { ip: string }) {
  const query = useIpIntelligence(ip);
  if (query.isPending)
    return (
      <div className="animate-pulse rounded border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-600">
        Определяем сеть и владельца IP…
      </div>
    );
  if (!query.data)
    return (
      <div className="rounded border border-rose-400/15 bg-rose-400/5 p-3 text-xs text-rose-200/70">
        Данные о владельце IP сейчас недоступны.
      </div>
    );
  const data = query.data;
  return (
    <div className="rounded border border-amber-300/15 bg-amber-300/[0.03] p-3 text-xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-amber-300/55">
            IP intelligence · RDAP/PTR
          </p>
          <p className="mt-1 text-sm font-medium text-amber-100">
            {data.owner}
          </p>
        </div>
        {data.sourceUrl && (
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-300"
          >
            Источник <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-1 text-[10px] text-slate-600">
            <Network className="size-3" />
            Сеть
          </dt>
          <dd className="mt-0.5 break-all font-mono text-slate-300">
            {data.networkName ?? data.scope}
            {data.range ? ` · ${data.range}` : ""}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-[10px] text-slate-600">
            <Globe2 className="size-3" />
            Страна / PTR
          </dt>
          <dd className="mt-0.5 break-all font-mono text-slate-300">
            {[data.country, ...data.reverseDns].filter(Boolean).join(" · ") ||
              "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
