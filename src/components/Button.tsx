import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "admin" | "ghost";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-gold-400 text-ink shadow-glow hover:bg-gold-300 focus-visible:outline-gold-300",
  secondary:
    "border border-paper/12 bg-paper/6 text-paper hover:bg-paper/10 focus-visible:outline-paper/50",
  danger:
    "border border-joker-red/45 bg-joker-red/10 text-paper hover:bg-joker-red/18 focus-visible:outline-joker-red",
  admin:
    "border border-joker-purple/45 bg-joker-purple/18 text-paper hover:bg-joker-purple/26 focus-visible:outline-joker-purple",
  ghost:
    "text-muted hover:bg-paper/7 hover:text-paper focus-visible:outline-paper/40"
};

const baseClass =
  "inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-center text-sm font-semibold leading-tight transition duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-45";

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
