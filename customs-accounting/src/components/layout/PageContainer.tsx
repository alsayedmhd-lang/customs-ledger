import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  width?: "normal" | "default" | "wide" | "full";
  dir?: "ltr" | "rtl";
};

const widthClass = {
  normal: "max-w-[72rem] lg:w-[88%] xl:w-[84%] 2xl:w-[80%]",
  default: "max-w-[72rem] lg:w-[88%] xl:w-[84%] 2xl:w-[80%]",
  wide: "max-w-[88rem] lg:w-[94%] xl:w-[92%] 2xl:w-[90%]",
  full: "w-full max-w-none",
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
      <div className={cn("mx-auto w-full min-w-0 transition-[width,max-width] duration-200 ease-out", widthClass[width], contentClassName)}>
        {children}
      </div>
    </div>
  );
}
