"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  maskChileanDateInput,
  normalizeChileanDate,
  parseToIso,
} from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface ChileanDateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function ChileanDateInput({
  value,
  onChange,
  className,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
}: ChileanDateInputProps) {
  const [draft, setDraft] = useState(() => normalizeChileanDate(value));
  const [lastExternalValue, setLastExternalValue] = useState(value);

  if (value !== lastExternalValue) {
    setLastExternalValue(value);
    setDraft(normalizeChileanDate(value));
  }

  return (
    <div
      className="space-y-1"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD-MM-AAAA"
        value={draft}
        onChange={(e) => {
          const next = maskChileanDateInput(e.target.value);
          setDraft(next);
          onChange(next);
        }}
        onBlur={() => {
          const normalized = normalizeChileanDate(draft);
          setDraft(normalized);
          onChange(normalized);
          onBlur?.();
        }}
        onFocus={onFocus}
        className={cn("h-8 text-sm tabular-nums", className)}
      />
      <p className="pointer-events-none text-[10px] text-muted-foreground">
        Formato chileno: DD-MM-AAAA
        {parseToIso(draft) ? " · válido" : draft ? " · revisa la fecha" : ""}
      </p>
    </div>
  );
}
