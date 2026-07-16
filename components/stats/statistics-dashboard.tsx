"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarCheck2,
  Eye,
  EyeOff,
  LoaderCircle,
  SearchCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ActivityBars } from "@/components/events/activity-bars";
import {
  TimeRangePicker,
  type TimeRangeValue,
} from "@/components/events/time-range-picker";
import { AiAnalysisDrawer } from "@/components/events/ai-analysis-drawer";
import { MetricCard } from "@/components/stats/metric-card";
import { RankList } from "@/components/stats/rank-list";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import type { EventStats } from "@/lib/domain/event-stats";
import { formatRangeSummary } from "@/lib/domain/time-range";

interface NodeItem {
  name: string;
  slug: string;
}

interface ClientItem {
  email: string;
  nodeId: string;
  nodeName: string;
  inboundTag: string | null;
}

interface AppliedScope {
  nodeId: string;
  clientEmails: string[];
  from: string;
  to: string;
  includeLoopback: boolean;
}

const json = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
};

const initialRange = (): TimeRangeValue => ({
  period: "1440",
  from: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
  to: "",
});

const localDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("ru-RU") : "—";

export function StatisticsDashboard() {
  const [nodeId, setNodeId] = useState("");
  const [clientEmails, setClientEmails] = useState<string[]>([]);
  const [range, setRange] = useState<TimeRangeValue>(initialRange);
  const [includeLoopback, setIncludeLoopback] = useState(false);
  const [scope, setScope] = useState<AppliedScope | null>(null);
  const [error, setError] = useState("");

  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: () => json<{ items: NodeItem[] }>("/api/nodes"),
  });
  const clientsQuery = useQuery({
    queryKey: ["clients", nodeId],
    queryFn: () =>
      json<{ items: ClientItem[] }>(
        `/api/clients${nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : ""}`,
      ),
  });
  const clientOptions = useMemo(() => {
    const clients = new Map<string, Set<string>>();
    for (const client of clientsQuery.data?.items ?? []) {
      const descriptions = clients.get(client.email) ?? new Set<string>();
      descriptions.add(
        [client.nodeName, client.inboundTag].filter(Boolean).join(" · "),
      );
      clients.set(client.email, descriptions);
    }
    return [...clients].map(([email, descriptions]) => ({
      value: email,
      label: email,
      description: [...descriptions].filter(Boolean).join("; "),
    }));
  }, [clientsQuery.data?.items]);
  const statsParams = useMemo(() => {
    if (!scope) return "";
    const params = new URLSearchParams({ from: scope.from, to: scope.to });
    if (scope.nodeId) params.set("nodeId", scope.nodeId);
    if (scope.includeLoopback) params.set("includeLoopback", "true");
    for (const email of scope.clientEmails) params.append("clientEmail", email);
    return params.toString();
  }, [scope]);
  const statsQuery = useQuery({
    queryKey: ["user-statistics", statsParams],
    queryFn: () => json<EventStats>(`/api/stats?${statsParams}`),
    enabled: Boolean(scope),
  });

  const apply = () => {
    if (!clientEmails.length) {
      setError("Выберите хотя бы одного пользователя");
      return;
    }
    const to = range.to || new Date().toISOString();
    const from = range.to
      ? range.from
      : new Date(
          new Date(to).getTime() - Number(range.period || 1440) * 60_000,
        ).toISOString();
    setError("");
    setScope({
      nodeId,
      clientEmails: [...clientEmails],
      from,
      to,
      includeLoopback,
    });
  };

  const stats = statsQuery.data;
  const knownPercent = stats?.total
    ? Math.round(((stats.total - stats.unknownDomain) / stats.total) * 100)
    : 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
            Exact database aggregation
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Статистика пользователей
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Все события выбранных пользователей за полный период — без скрытой
            выборки последних 20 000 строк.
          </p>
        </div>
        {scope && (
          <div className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-200/80">
            <SearchCheck className="mr-2 inline size-3.5" />
            Агрегация по всей базе за период
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,0.9fr)_minmax(260px,1.4fr)_minmax(210px,1fr)_auto_auto]">
          <Select
            value={nodeId}
            onValueChange={(value) => {
              setNodeId(value);
              setClientEmails([]);
              setError("");
            }}
            placeholder="Все серверы"
            options={(nodesQuery.data?.items ?? []).map((node) => ({
              value: node.slug,
              label: node.name,
            }))}
          />
          <MultiSelect
            value={clientEmails}
            onValueChange={(value) => {
              setClientEmails(value);
              setError("");
            }}
            options={clientOptions}
            loading={clientsQuery.isLoading}
            placeholder="Выберите пользователей"
          />
          <TimeRangePicker
            value={range}
            onValueChange={setRange}
            allowAll={false}
          />
          <Button
            variant="ghost"
            aria-pressed={includeLoopback}
            onClick={() => setIncludeLoopback((current) => !current)}
            className={includeLoopback ? "text-cyan-300" : "text-slate-500"}
            title={
              includeLoopback
                ? "Скрыть подключения к 127.0.0.1"
                : "Показать подключения к 127.0.0.1"
            }
          >
            {includeLoopback ? (
              <Eye className="size-3.5" />
            ) : (
              <EyeOff className="size-3.5" />
            )}
            127.0.0.1
          </Button>
          <Button onClick={apply} disabled={statsQuery.isFetching}>
            {statsQuery.isFetching ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <BarChart3 className="size-4" />
            )}
            Показать
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-xs text-rose-300">
            {error}
          </p>
        )}
      </div>

      {!scope && (
        <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-slate-800 bg-slate-900/20 text-center">
          <div>
            <Users className="mx-auto size-8 text-slate-700" />
            <p className="mt-4 text-sm text-slate-300">
              Выберите одного или нескольких пользователей
            </p>
            <p className="mt-1 text-xs text-slate-600">
              По умолчанию подготовлен период за последние 24 часа.
            </p>
          </div>
        </div>
      )}

      {statsQuery.error && (
        <div className="rounded-lg border border-rose-400/25 bg-rose-400/5 p-4 text-sm text-rose-200">
          Не удалось построить статистику: {statsQuery.error.message}
        </div>
      )}

      {scope && stats && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3 text-xs text-slate-500">
            <span className="flex items-center gap-2 text-slate-300">
              <CalendarCheck2 className="size-3.5 text-cyan-300" />
              {formatRangeSummary(scope.from, scope.to)}
            </span>
            <span>{scope.clientEmails.length} пользователей</span>
            <span>Первое событие: {localDateTime(stats.firstActivity)}</span>
            <span>Последнее: {localDateTime(stats.lastActivity)}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="События подключений"
              value={stats.total.toLocaleString("ru-RU")}
              detail="учтены все строки периода"
            />
            <MetricCard
              label="Уникальные назначения"
              value={stats.uniqueDestinations.toLocaleString("ru-RU")}
            />
            <MetricCard
              label="Активные пользователи"
              value={stats.clients.length}
              detail={`выбрано ${scope.clientEmails.length}`}
            />
            <MetricCard
              label="Назначения с доменом"
              value={`${knownPercent}%`}
              detail={`${stats.unknownDomain.toLocaleString("ru-RU")} событий только с IP`}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-slate-200">
                  Активность подключений
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Наведите на столбец, чтобы увидеть точный локальный интервал.
                </p>
              </div>
              <span className="font-mono text-[10px] text-slate-600">
                бакет {Math.round(stats.range.bucketMs / 60_000)} мин.
              </span>
            </div>
            <ActivityBars
              items={stats.activity}
              className="mt-5 h-28 gap-0.5"
            />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-600">
              <span>{new Date(scope.from).toLocaleString("ru-RU")}</span>
              <span>{new Date(scope.to).toLocaleString("ru-RU")}</span>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <RankList title="Топ назначений" items={stats.topDomains} />
            <RankList title="Outbound" items={stats.topOutbounds} />
            <RankList title="Протоколы" items={stats.networks} />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/45">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-200">
                Пользователи за период
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Сравнение по событиям и уникальным назначениям.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-950/50 font-mono text-[10px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Пользователь</th>
                    <th className="px-4 py-3">События</th>
                    <th className="px-4 py-3">Доля</th>
                    <th className="px-4 py-3">Назначения</th>
                    <th className="px-4 py-3">Первая активность</th>
                    <th className="px-4 py-3">Последняя активность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {stats.clients.map((client) => (
                    <tr key={client.label} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-cyan-200">
                        {client.label}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-200">
                        {client.value.toLocaleString("ru-RU")}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {(client.share * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {client.uniqueDestinations.toLocaleString("ru-RU")}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {localDateTime(client.firstActivity)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {localDateTime(client.lastActivity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!stats.clients.length && (
              <p className="px-4 py-12 text-center text-xs text-slate-600">
                За выбранный период событий этих пользователей нет.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/35 px-4 py-3">
            <p className="text-xs text-slate-500">
              Исторические байты и online-время здесь не показаны: база пока
              хранит только последний снимок метрик Xray.
            </p>
            <AiAnalysisDrawer
              scope={{
                nodeId: scope.nodeId || undefined,
                clientEmails: scope.clientEmails,
                minutes: 60,
                from: scope.from,
                to: scope.to,
                includeLoopback: scope.includeLoopback,
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}
