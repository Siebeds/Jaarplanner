import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("mb-3 block", className)}>
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-zwak">{hint}</span>}
    </label>
  );
}

const baseVeld =
  "w-full rounded-xl border border-rand bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-zwak focus:border-terra focus:outline-none focus:ring-2 focus:ring-terra/30";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(baseVeld, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(baseVeld, "min-h-20 resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cn(baseVeld, "appearance-none bg-no-repeat", className)} {...props}>
      {children}
    </select>
  );
}
