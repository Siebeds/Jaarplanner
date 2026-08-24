import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";
import { IcoonChevron } from "../Iconen";

/** A labelled form row. The label is always visible: a placeholder is not a label. */
export function Veld({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-meta font-medium text-inkt-zacht">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

export function Invoer({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-raak w-full rounded-veld border border-lijn-veld bg-kaart px-3 text-body text-inkt",
        "placeholder:text-inkt-zwak",
        "transition-colors duration-150 hover:border-inkt-zacht",
        className,
      )}
      {...props}
    />
  );
}

export function Keuze({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-raak w-full appearance-none rounded-veld border border-lijn-veld bg-kaart pl-3 pr-10 text-body text-inkt",
          "transition-colors duration-150 hover:border-inkt-zacht",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <IcoonChevron className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-inkt-zwak" />
    </div>
  );
}

/** A multi-line field. Three rows and free to grow: two rows hides most of what is already typed. */
export function Tekstvlak({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(
        "w-full rounded-veld border border-lijn-veld bg-kaart px-3 py-2 text-body text-inkt",
        "placeholder:text-inkt-zwak",
        "transition-colors duration-150 hover:border-inkt-zacht",
        className,
      )}
      {...props}
    />
  );
}
