import * as React from "react";

import { cn } from "@/lib/utils";

export type NativeSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type NativeSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
  options: NativeSelectOption[];
  placeholder?: string;
};

/**
 * Stable dropdown that avoids Radix ref-composition loops.
 * Styled to match shadcn input/select tokens.
 */
export function NativeSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
  ...props
}: NativeSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
