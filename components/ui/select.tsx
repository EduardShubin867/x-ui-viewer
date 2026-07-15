"use client";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption { value: string; label: string }
export function Select({ value, onValueChange, options, placeholder, className, disabled }: { value: string; onValueChange(value: string): void; options: SelectOption[]; placeholder: string; className?: string; disabled?: boolean }) {
  return <SelectPrimitive.Root value={value || "__all"} onValueChange={(next) => onValueChange(next === "__all" ? "" : next)} disabled={disabled}>
    <SelectPrimitive.Trigger className={cn("flex h-9 min-w-32 items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-300 outline-none focus:border-cyan-400/60", className)}>
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon><ChevronDown className="size-3.5 text-slate-500" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" sideOffset={5} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-slate-700 bg-slate-900 p-1 shadow-2xl">
        <SelectPrimitive.Viewport>
          <SelectPrimitive.Item value="__all" className="relative flex cursor-default select-none items-center rounded px-7 py-2 text-sm text-slate-300 outline-none data-[highlighted]:bg-slate-800"><SelectPrimitive.ItemIndicator className="absolute left-2"><Check className="size-3" /></SelectPrimitive.ItemIndicator><SelectPrimitive.ItemText>{placeholder}</SelectPrimitive.ItemText></SelectPrimitive.Item>
          {options.map((option) => <SelectPrimitive.Item key={option.value} value={option.value} className="relative flex cursor-default select-none items-center rounded px-7 py-2 text-sm text-slate-300 outline-none data-[highlighted]:bg-slate-800"><SelectPrimitive.ItemIndicator className="absolute left-2"><Check className="size-3" /></SelectPrimitive.ItemIndicator><SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText></SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
