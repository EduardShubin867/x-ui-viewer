"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatRangeSummary,
  formatUtcOffset,
  localDateTimeInputToIso,
  PERIOD_LABELS,
  toLocalDateTimeInput,
} from "@/lib/domain/time-range";

export interface TimeRangeValue {
  period: string;
  from: string;
  to: string;
}

interface TimeRangePickerProps {
  value: TimeRangeValue;
  onValueChange(value: TimeRangeValue): void;
  disabled?: boolean;
  allowAll?: boolean;
}

const presets = Object.entries(PERIOD_LABELS);

export function TimeRangePicker({
  value,
  onValueChange,
  disabled,
  allowAll = true,
}: TimeRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [error, setError] = useState("");
  const exact = Boolean(value.from && value.to);
  const summary = exact
    ? formatRangeSummary(value.from, value.to)
    : (PERIOD_LABELS[value.period] ?? "Весь период");

  const changeOpen = (next: boolean) => {
    if (next) {
      const now = new Date();
      const defaultFrom = new Date(now.getTime() - 60 * 60_000);
      setDraftFrom(
        toLocalDateTimeInput(exact ? value.from : defaultFrom.toISOString()),
      );
      setDraftTo(toLocalDateTimeInput(exact ? value.to : now.toISOString()));
      setError("");
    }
    setOpen(next);
  };
  const choosePreset = (minutes: string, now: Date) => {
    onValueChange({
      period: minutes,
      from: new Date(now.getTime() - Number(minutes) * 60_000).toISOString(),
      to: "",
    });
    setOpen(false);
  };
  const applyExact = () => {
    const from = localDateTimeInputToIso(draftFrom);
    const to = localDateTimeInputToIso(draftTo);
    if (!from || !to) return setError("Укажите начало и конец периода");
    const duration = new Date(to).getTime() - new Date(from).getTime();
    if (duration <= 0) return setError("Конец должен быть позже начала");
    if (duration > 31 * 24 * 60 * 60_000)
      return setError("Максимальный диапазон — 31 день");
    if (new Date(to).getTime() > Date.now() + 60_000)
      return setError("Конец периода не может быть в будущем");
    onValueChange({ period: "", from, to });
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={changeOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-300 outline-none transition-colors focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-45"
          title={summary}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarClock
              className={cn(
                "size-3.5 shrink-0",
                value.from ? "text-cyan-300" : "text-slate-600",
              )}
            />
            <span className="truncate whitespace-nowrap">{summary}</span>
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-slate-500 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={5}
          collisionPadding={12}
          aria-label="Выбор периода"
          className="z-50 w-[min(430px,calc(100vw-24px))] rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl outline-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-100">
                Период событий
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Быстрые периоды обновляются вместе с live-лентой.
              </p>
            </div>
            <Clock3 className="mt-0.5 size-4 shrink-0 text-cyan-300" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {presets.map(([minutes, label]) => (
              <button
                key={minutes}
                type="button"
                onClick={() => choosePreset(minutes, new Date())}
                className={cn(
                  "flex h-8 items-center justify-center rounded border px-2 text-xs outline-none transition-colors hover:border-cyan-400/50 hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                  value.period === minutes && !exact
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                    : "border-slate-700 bg-slate-950/60 text-slate-400",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-slate-600">
            <span className="h-px flex-1 bg-slate-800" />
            Точный диапазон
            <span className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs text-slate-400">
              <span>От</span>
              <Input
                type="datetime-local"
                value={draftFrom}
                onChange={(event) => {
                  setDraftFrom(event.target.value);
                  setError("");
                }}
                className="scheme-dark [color-scheme:dark]"
              />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">
              <span>До</span>
              <Input
                type="datetime-local"
                value={draftTo}
                max={toLocalDateTimeInput(new Date().toISOString())}
                onChange={(event) => {
                  setDraftTo(event.target.value);
                  setError("");
                }}
                className="scheme-dark [color-scheme:dark]"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Время браузера:{" "}
            <span className="font-mono text-slate-300">
              {Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"} ·{" "}
              {formatUtcOffset()}
            </span>
          </p>
          {error && (
            <p role="alert" className="mt-2 text-xs text-rose-300">
              {error}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            {allowAll ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onValueChange({ period: "", from: "", to: "" });
                  setOpen(false);
                }}
              >
                <RotateCcw className="size-3.5" />
                Весь период
              </Button>
            ) : (
              <span className="text-[10px] text-slate-600">
                Максимум 31 день
              </span>
            )}
            <Button size="sm" onClick={applyExact}>
              <Check className="size-3.5" />
              Применить
            </Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
