import Link from "next/link";
import { Activity, Bug, RadioTower } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-300"><RadioTower className="size-4" /></span>
          <span><strong className="block text-sm tracking-tight">XRAY SCOPE</strong><span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-slate-600">connection observatory</span></span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-400 hover:bg-slate-900 hover:text-white"><Activity className="size-3.5" />События</Link>
          <Link href="/debug" className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-400 hover:bg-slate-900 hover:text-white"><Bug className="size-3.5" />Дебаг-сессия</Link>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-[1800px] px-5 py-5">{children}</main>
  </div>;
}
