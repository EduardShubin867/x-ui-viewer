"use client";
import { useQuery } from "@tanstack/react-query";
import { Bug, Clock3, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { EventsDashboard } from "@/components/events/events-dashboard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface NodeItem { name: string; slug: string }
interface ClientItem { email: string; nodeId: string }
interface Session { nodeId: string; clientEmail: string; from: string; endsAt: number }
const get = async <T,>(url: string) => (await fetch(url)).json() as Promise<T>;

export function DebugSession() {
  const [nodeId, setNodeId] = useState(""); const [clientEmail, setClientEmail] = useState(""); const [duration, setDuration] = useState("10"); const [session, setSession] = useState<Session | null>(null); const [now, setNow] = useState(0);
  const nodes = useQuery({ queryKey: ["nodes"], queryFn: () => get<{ items: NodeItem[] }>("/api/nodes") });
  const clients = useQuery({ queryKey: ["clients", nodeId], queryFn: () => get<{ items: ClientItem[] }>(`/api/clients?nodeId=${encodeURIComponent(nodeId)}`), enabled: Boolean(nodeId) });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const remaining = session ? Math.max(0, session.endsAt - now) : 0;
  const remainingLabel = `${String(Math.floor(remaining / 60_000)).padStart(2, "0")}:${String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0")}`;
  if (!session || remaining === 0) return <section className="mx-auto max-w-3xl py-10"><div className="mb-7 text-center"><span className="mx-auto mb-4 grid size-12 place-items-center rounded-lg border border-amber-300/25 bg-amber-300/10 text-amber-300"><Bug className="size-5" /></span><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300/70">Focused capture</p><h1 className="text-2xl font-semibold">Новая дебаг-сессия</h1><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Выберите клиента. После запуска экран покажет только новые подключения до завершения таймера.</p></div><div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6"><div className="grid gap-4 sm:grid-cols-3"><label className="space-y-2"><span className="text-xs text-slate-500">Сервер</span><Select value={nodeId} onValueChange={(value) => { setNodeId(value); setClientEmail(""); }} placeholder="Выберите" options={(nodes.data?.items ?? []).map((node) => ({ value: node.slug, label: node.name }))} /></label><label className="space-y-2"><span className="text-xs text-slate-500">Клиент</span><Select value={clientEmail} onValueChange={setClientEmail} placeholder="Выберите" disabled={!nodeId} options={(clients.data?.items ?? []).map((client) => ({ value: client.email, label: client.email }))} /></label><label className="space-y-2"><span className="text-xs text-slate-500">Длительность</span><Select value={duration} onValueChange={setDuration} placeholder="10 минут" options={[5, 10, 30, 60].map((value) => ({ value: String(value), label: `${value} минут` }))} /></label></div><Button className="mt-6 w-full" disabled={!nodeId || !clientEmail} onClick={() => { const startedAt = Date.now(); setNow(startedAt); setSession({ nodeId, clientEmail, from: new Date(startedAt).toISOString(), endsAt: startedAt + Number(duration) * 60_000 }); }}><Bug className="size-4" />Начать дебаг-сессию</Button></div></section>;
  return <section className="space-y-4"><div className="flex items-center justify-between rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300/70">Debug session active</p><p className="mt-1 text-sm text-slate-300"><span className="font-mono text-cyan-300">{session.clientEmail}</span><span className="mx-2 text-slate-700">@</span>{session.nodeId}</p></div><div className="flex items-center gap-4"><span className="flex items-center gap-2 font-mono text-xl text-amber-200"><Clock3 className="size-4" />{remainingLabel}</span><Button variant="danger" size="sm" onClick={() => setSession(null)}><Square className="size-3" />Завершить</Button></div></div><EventsDashboard fixed={{ nodeId: session.nodeId, clientEmail: session.clientEmail, from: session.from }} /></section>;
}
