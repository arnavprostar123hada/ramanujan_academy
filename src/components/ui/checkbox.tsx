import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "checked"> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/**
 * Native checkbox to avoid Radix ref-composition loops (setRef → setState) that can
 * trigger "Maximum update depth exceeded" in some environments.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => {
    const isControlled = checked !== undefined;

    return (
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <input
          ref={ref}
          type="checkbox"
          disabled={disabled}
          checked={checked}
          defaultChecked={defaultChecked}
          // Avoid React controlled warning when used as a display-only checkbox.
          readOnly={isControlled && !onCheckedChange}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className={cn(
            "peer h-4 w-4 appearance-none rounded-sm border border-input bg-background ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "checked:border-primary checked:bg-primary",
            className,
          )}
          {...props}
        />
        <Check className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100" />
      </span>
    );
  },
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
