import type { InputHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

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
    <label className="grid gap-1.5 text-[13px] font-semibold text-inksoft">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-faint">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "min-h-[42px] rounded-[10px] border border-black/[0.14] bg-field px-[13px] text-sm text-ink outline-none transition focus:border-brand-red",
        className
      )}
      {...props}
    />
  );
}
