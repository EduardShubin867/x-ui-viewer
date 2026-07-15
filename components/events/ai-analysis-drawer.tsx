"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Copy, LoaderCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Scope { nodeId?: string; clientEmails: string[]; minutes: number; includeLoopback: boolean }
const request = async <T,>(url: string, init?: RequestInit): Promise<T> => { const response = await fetch(url, init); const body = await response.json(); if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`); return body as T; };

export function AiAnalysisDrawer({ scope }: { scope: Scope }) {
  const [open, setOpen] = useState(false);
  const status = useQuery({ queryKey: ["ai-status"], queryFn: () => request<{ enabled: boolean; model: string | null }>("/api/ai/analyze"), staleTime: 60_000 });
  const analysis = useMutation({ mutationFn: () => request<{ insufficient: boolean; reason?: string; content?: string; model?: string; analyzedEvents?: number }>("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scope) }) });
  const result = analysis.data?.content ?? analysis.data?.reason;
  return <>
    <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className={status.data?.enabled ? "border-violet-400/30 text-violet-200" : "text-slate-500"}><Sparkles className="size-3.5" />{status.data?.enabled ? "AI-анализ" : "AI не настроен"}</Button>
    {open && <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/70 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <aside role="dialog" aria-modal="true" aria-label="AI-анализ трафика" className="flex h-full w-full max-w-lg flex-col border-l border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 p-5"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-300">OpenRouter</p><h2 className="mt-1 text-lg font-semibold">AI-анализ трафика</h2><p className="mt-1 text-xs text-slate-500">{status.data?.model ?? "Модель не настроена"}</p></div><Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Закрыть"><X className="size-4" /></Button></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs leading-5 text-emerald-100/75"><ShieldCheck className="mr-2 inline size-4 text-emerald-300" />Передаются только агрегаты. Raw-логи, source IP и реальные email в OpenRouter не отправляются.</div>
          <div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded border border-slate-800 p-3"><span className="text-slate-600">Период</span><p className="mt-1 font-mono text-slate-300">{scope.minutes} минут</p></div><div className="rounded border border-slate-800 p-3"><span className="text-slate-600">Клиенты</span><p className="mt-1 font-mono text-slate-300">{scope.clientEmails.length || "все"}</p></div></div>
          {!status.isLoading && !status.data?.enabled && <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100"><p className="font-medium">OpenRouter пока не настроен</p><p className="mt-1 text-xs text-amber-100/60">Добавьте OPENROUTER_API_KEY и OPENROUTER_MODEL в env web-сервиса.</p></div>}
          {analysis.isPending && <div className="grid min-h-48 place-items-center text-sm text-slate-400"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin text-violet-300" />Анализируем агрегаты…</span></div>}
          {analysis.error && <div className="rounded-lg border border-rose-400/25 bg-rose-400/5 p-4 text-sm text-rose-200">{analysis.error.message}</div>}
          {result && !analysis.isPending && <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-4"><div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium"><Bot className="size-4 text-violet-300" />Результат</span><Button variant="ghost" size="icon" onClick={() => void navigator.clipboard.writeText(result)} aria-label="Копировать результат"><Copy className="size-3.5" /></Button></div><div className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{result}</div>{analysis.data?.analyzedEvents && <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-600">Проанализировано событий: {analysis.data.analyzedEvents}</p>}</div>}
        </div>
        <div className="border-t border-slate-800 p-4"><Button className="w-full" disabled={!status.data?.enabled || analysis.isPending} onClick={() => analysis.mutate()}><Sparkles className="size-4" />{result ? "Обновить анализ" : "Анализировать"}</Button></div>
      </aside>
    </div>}
  </>;
}
