"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type BriefInputProps = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  value?: string;
  isSaving?: boolean;
};

export function BriefInput({
  onSubmit,
  disabled,
  readOnly,
  value = "",
  isSaving,
}: BriefInputProps) {
  const [text, setText] = useState(value);

  if (readOnly) {
    return (
      <p className="rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
        {value}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe the job… e.g. 3m wide by 6m long hardwood deck with stairs and a pergola"
        rows={4}
        disabled={disabled}
      />
      <Button
        type="button"
        onClick={() => onSubmit(text.trim())}
        disabled={disabled || isSaving || !text.trim()}
      >
        {isSaving ? "Analysing brief…" : "Analyse job"}
      </Button>
    </div>
  );
}
