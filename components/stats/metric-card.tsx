export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-900/45 p-4"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>;
}
