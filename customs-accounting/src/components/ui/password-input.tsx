import { forwardRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";

export const PasswordInput = forwardRef<HTMLInputElement, Omit<ComponentProps<"input">, "type"> & { isAR: boolean; toggleClassName?: string }>(
  ({ isAR, className, disabled, toggleClassName, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const label = visible ? (isAR ? "إخفاء كلمة المرور" : "Hide password") : (isAR ? "إظهار كلمة المرور" : "Show password");
    return <div data-password-field dir={isAR ? "rtl" : "ltr"} className="flex w-full min-w-0 items-stretch gap-1">
      <Input {...props} ref={ref} disabled={disabled} type={visible ? "text" : "password"} className={`min-w-0 flex-1 ${className || ""}`} style={{ ...props.style, minWidth: 0, width: 0, textAlign: isAR ? "right" : "left" }} />
      <button type="button" disabled={disabled} aria-label={label} title={label} aria-pressed={visible}
        onClick={() => setVisible(v => !v)} className={`inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 ${toggleClassName || ""}`} style={{ position: "static", flex: "0 0 32px", width: 32, padding: 6 }}>
        {visible ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>;
  }
);
PasswordInput.displayName = "PasswordInput";
