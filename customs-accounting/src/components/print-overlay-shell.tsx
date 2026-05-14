import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PrintOverlayShellProps = {
  children: ReactNode;
  className?: string;
};

export function PrintOverlayShell({ children, className }: PrintOverlayShellProps) {
  return (
    <div className={cn("relative overflow-visible", className)}>
      {children}
    </div>
  );
}
