import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "admin" | "ghost";

const variantClass: Record<ButtonVariant, string> = {
  primary: "min-h-[46px] px-5 rounded-[11px] bg-brand-red text-white font-bold text-sm hover:bg-brand-redDark focus-visible:outline-brand-red",
  secondary:
    "min-h-10 px-4 rounded-[10px] border border-black/12 bg-card text-ink font-semibold text-[13px] hover:bg-black/[0.03] focus-visible:outline-black/30",
  danger:
    "min-h-10 px-4 rounded-[10px] border border-brand-danger/35 bg-brand-danger/[0.08] text-brand-redDark font-semibold text-[13px] hover:bg-brand-danger/[0.14] focus-visible:outline-brand-danger",
  admin:
    "min-h-[46px] px-5 rounded-[11px] border border-brand-teal/40 bg-brand-teal/[0.09] text-brand-teal font-bold text-sm hover:bg-brand-teal/[0.16] focus-visible:outline-brand-teal",
  ghost: "min-h-10 px-4 rounded-[10px] text-muted font-semibold text-[13px] hover:bg-black/[0.04] hover:text-ink focus-visible:outline-black/30"
};

const baseClass =
  "inline-flex max-w-full items-center justify-center gap-2 text-center leading-tight transition-all duration-200 ease-out active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={clsx(baseClass, variantClass[variant], className)} {...props} />;
}

export function ButtonLink({
  className,
  variant = "primary",
  children,
  ...props
}: LinkProps & { variant?: ButtonVariant; children: ReactNode }) {
  return (
    <Link className={clsx(baseClass, variantClass[variant], className)} {...props}>
      {children}
    </Link>
  );
}
