"use client";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, Users, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface MultiSelectProps {
  value: readonly string[];
  onValueChange(value: string[]): void;
  options: readonly MultiSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  maxSelected?: number;
}

export function MultiSelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = "Найти клиента…",
  disabled,
  loading,
  className,
  maxSelected = 100,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([...value]);
  const [search, setSearch] = useState("");
  const selected = useMemo(() => new Set(draft), [draft]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? options.filter((option) =>
          `${option.label} ${option.description ?? ""}`
            .toLowerCase()
            .includes(needle),
        )
      : options;
  }, [options, search]);
  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((option) => option.value === value[0])?.label ??
          value[0])
        : `Клиенты · ${value.length}`;
  const toggle = (optionValue: string) =>
    setDraft((current) =>
      current.includes(optionValue)
        ? current.filter((item) => item !== optionValue)
        : current.length < maxSelected
          ? [...current, optionValue]
          : current,
    );
  const changeOpen = (next: boolean) => {
    if (next) {
      setDraft([...value]);
      setSearch("");
    }
    setOpen(next);
  };
  const apply = () => {
    onValueChange(
      [...new Set(draft)].sort((left, right) => left.localeCompare(right)),
    );
    setOpen(false);
  };
  const handleListKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "[data-multi-option]",
      ),
    ];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? Math.min(current + 1, items.length - 1)
            : Math.max(current - 1, 0);
    items[next]?.focus();
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={changeOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-300 outline-none transition-colors focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-45",
            className,
          )}
          title={value.length ? value.join("\n") : placeholder}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Users
              className={cn(
                "size-3.5 shrink-0",
                value.length ? "text-cyan-300" : "text-slate-600",
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
          aria-label="Выбор клиентов"
          align="start"
          sideOffset={5}
          collisionPadding={12}
          className="z-50 flex max-h-[min(520px,75dvh)] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl outline-none"
        >
          <div className="border-b border-slate-800 p-3">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-600" />
              <Input
                aria-label="Поиск клиентов"
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="bg-slate-950 pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2 grid size-5 place-items-center text-slate-600 hover:text-slate-200"
                  aria-label="Очистить поиск"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </label>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                Выбрано:{" "}
                <span className="font-mono text-cyan-300">{draft.length}</span>{" "}
                / {maxSelected}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) =>
                      [
                        ...new Set([
                          ...current,
                          ...filtered.map((option) => option.value),
                        ]),
                      ].slice(0, maxSelected),
                    )
                  }
                  disabled={!filtered.length}
                  className="text-slate-400 hover:text-cyan-300 disabled:opacity-40"
                >
                  Выбрать показанных
                </button>
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  disabled={!draft.length}
                  className="text-slate-400 hover:text-rose-300 disabled:opacity-40"
                >
                  Очистить
                </button>
              </div>
            </div>
          </div>
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label="Клиенты"
            onKeyDown={handleListKeys}
            className="min-h-24 flex-1 overflow-y-auto p-1.5"
          >
            {loading && (
              <div className="px-3 py-8 text-center text-xs text-slate-500">
                Загружаем клиентов…
              </div>
            )}
            {!loading && !filtered.length && (
              <div className="px-3 py-8 text-center text-xs text-slate-500">
                Клиенты не найдены
              </div>
            )}
            {!loading &&
              filtered.map((option) => (
                <button
                  data-multi-option
                  type="button"
                  role="option"
                  aria-selected={selected.has(option.value)}
                  key={option.value}
                  onClick={() => toggle(option.value)}
                  className="flex min-h-11 w-full items-center gap-3 rounded px-2.5 py-2 text-left outline-none hover:bg-slate-800 focus:bg-slate-800"
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      selected.has(option.value)
                        ? "border-cyan-300 bg-cyan-300 text-slate-950"
                        : "border-slate-600 bg-slate-950",
                    )}
                    aria-hidden="true"
                  >
                    {selected.has(option.value) && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs text-slate-200">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/55 p-2.5">
            <span aria-live="polite" className="text-[10px] text-slate-400">
              {draft.length ? `${draft.length} выбрано` : "Будут показаны все"}
            </span>
            <div className="flex gap-2">
              <PopoverPrimitive.Close asChild>
                <Button variant="ghost" size="sm">
                  Отмена
                </Button>
              </PopoverPrimitive.Close>
              <Button size="sm" onClick={apply}>
                Применить{draft.length ? ` · ${draft.length}` : ""}
              </Button>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
