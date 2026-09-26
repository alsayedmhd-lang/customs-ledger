import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dir?: "ltr" | "rtl";
};

export default function PageContainer({
  children,
  className,
  contentClassName,
  dir,
}: PageContainerProps) {
  const resolvedDir = dir ?? "ltr";

  return (
    <div
      className={cn("w-full min-w-0 pb-8 text-start", className)}
      dir={resolvedDir}
      data-dir={resolvedDir}
    >
      <div className={cn("w-full min-w-0", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
