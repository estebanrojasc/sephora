"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  maskChileanDateInput,
  normalizeChileanDate,
  normalizeChileanDateForSync,
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
  const [draft, setDraft] = useState(() => normalizeChileanDateForSync(value));
  const [focused, setFocused] = useState(false);
  const lastCommitted = useRef(value);

  useEffect(() => {
    if (focused) return;
    if (value === lastCommitted.current) return;
    lastCommitted.current = value;
    setDraft(normalizeChileanDateForSync(value));
  }, [value, focused]);

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
          setDraft(maskChileanDateInput(e.target.value));
        }}
        onBlur={() => {
          setFocused(false);
          const normalized = normalizeChileanDate(draft);
          setDraft(normalized);
          lastCommitted.current = normalized;
          onChange(normalized);
          onBlur?.();
        }}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        className={cn("h-8 text-sm tabular-nums", className)}
      />
      <p className="pointer-events-none text-[10px] text-muted-foreground">
        Formato chileno: DD-MM-AAAA
        {parseToIso(draft) ? " · válido" : draft ? " · revisa la fecha" : ""}
      </p>
    </div>
  );
}
