"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraInputProps {
  onCapture: (file: File) => void;
  disabled?: boolean;
  label?: string;
}

export function CameraInput({
  onCapture,
  disabled,
  label = "Tomar foto",
}: CameraInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCapture(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        size="lg"
        className="h-14 w-full"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="size-5" />
        {label}
      </Button>
    </>
  );
}
