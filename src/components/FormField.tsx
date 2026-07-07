import type { InputHTMLAttributes, ReactNode } from "react";

export function FormField({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-paper">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="min-h-12 rounded-md border border-paper/12 bg-felt-900 px-3 text-base text-paper outline-none transition placeholder:text-muted/65 focus:border-gold-400"
      {...props}
    />
  );
}

