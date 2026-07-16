"use client";

import type { ActivityBucket } from "@/lib/domain/activity";
import { cn } from "@/lib/utils";

const formatDate = (date: Date) =>
  date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
const formatTime = (date: Date) =>
  date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function tooltipLabel(point: ActivityBucket): string {
  const from = new Date(point.from);
  const to = new Date(point.to);
  const sameDay =
    from.toLocaleDateString("ru-RU") === to.toLocaleDateString("ru-RU");
  return sameDay
    ? `${formatDate(from)}, ${formatTime(from)}–${formatTime(to)}`
    : `${formatDate(from)}, ${formatTime(from)} – ${formatDate(to)}, ${formatTime(to)}`;
}

export function ActivityBars({
  items,
  className,
}: {
  items: readonly ActivityBucket[];
  className?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  if (!items.length)
    return (
      <div className="mt-2 flex h-5 items-center text-[10px] text-slate-600">
        Нет интервалов
      </div>
    );
  return (
    <div
      role="group"
      aria-label="Активность подключений по времени"
      className={cn("mt-2 flex h-7 items-end gap-px", className)}
    >
      {items.map((item, index) => {
        const label = tooltipLabel(item);
        const edge =
          index < 3
            ? "left-0"
            : index > items.length - 4
              ? "right-0"
              : "left-1/2 -translate-x-1/2";
        return (
          <button
            type="button"
            key={item.from}
            aria-label={`${label}: ${item.value} событий`}
            className="group relative flex h-full min-w-0 flex-1 items-end rounded-[1px] outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          >
            <span
              aria-hidden="true"
              className={cn(
                "w-full rounded-t-[1px] transition-colors group-hover:bg-cyan-200 group-focus:bg-cyan-200",
                item.value ? "bg-cyan-300/60" : "h-px bg-slate-700",
              )}
              style={
                item.value
                  ? { height: `${Math.max(10, (item.value / max) * 100)}%` }
                  : undefined
              }
            />
            <span
              role="tooltip"
              className={cn(
                "pointer-events-none absolute bottom-full z-30 mb-2 hidden w-max max-w-56 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-left shadow-xl group-hover:block group-focus:block",
                edge,
              )}
            >
              <span className="block whitespace-nowrap text-[10px] text-slate-400">
                {label}
              </span>
              <span className="mt-0.5 block font-mono text-xs text-cyan-200">
                {item.value} событий
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
