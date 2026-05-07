import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  width?: "default" | "wide" | "full";
  dir?: "ltr" | "rtl";
};

const widthClass = {
  default: "max-w-6xl lg:w-[86%] xl:w-[82%] 2xl:w-[80%]",
  wide: "max-w-7xl",
  full: "max-w-none",
};

export default function PageContainer({
  children,
  className,
  contentClassName,
  width = "default",
  dir,
}: PageContainerProps) {
  const resolvedDir = dir ?? "ltr";

  return (
    <div
      className={cn("w-full min-w-0 px-1 pb-8 text-start sm:px-2", className)}
      dir={resolvedDir}
      data-dir={resolvedDir}
    >
      <div className={cn("mx-auto w-full min-w-0", widthClass[width], contentClassName)}>
        {children}
      </div>
    </div>
  );
}
