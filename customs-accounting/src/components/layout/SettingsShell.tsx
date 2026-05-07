import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import PageContainer from "./PageContainer";

type SettingsTab<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
  color?: string;
};

type SettingsShellProps<T extends string> = {
  title: ReactNode;
  description?: ReactNode;
  tabs: ReadonlyArray<SettingsTab<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  children: ReactNode;
  actions?: ReactNode;
  headerMeta?: ReactNode;
  className?: string;
  contentClassName?: string;
  dir?: "ltr" | "rtl";
  width?: "normal" | "default" | "wide" | "full";
  tabsSticky?: boolean;
};

export default function SettingsShell<T extends string>({
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
  children,
  actions,
  headerMeta,
  className,
  contentClassName,
  dir,
  width = "default",
  tabsSticky = true,
}: SettingsShellProps<T>) {
  const resolvedDir = dir ?? "ltr";

  return (
    <PageContainer width={width} dir={resolvedDir} className={className}>
      <div className="space-y-5" dir={resolvedDir} data-settings-shell={resolvedDir}>
        <div className="rounded-2xl border border-border/60 bg-card/95 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 text-start">
              {headerMeta && <div className="mb-3">{headerMeta}</div>}
              <h1 className="text-2xl font-bold tracking-normal text-foreground">{title}</h1>
              {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center justify-start gap-2">{actions}</div>}
          </div>
        </div>

        <div
          className={cn(
            "z-20 rounded-2xl border border-border/60 bg-card/95 p-2 shadow-sm backdrop-blur",
            tabsSticky && "sticky top-2"
          )}
        >
          <nav
            className="flex max-w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap scroll-px-2 pb-0.5 text-start overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            dir={resolvedDir}
            aria-label="Settings tabs"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold leading-none transition",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className={cn("h-4 w-4 shrink-0", !selected && tab.color)} />}
                  <span className="leading-none">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className={cn("min-w-0 space-y-5", contentClassName)}>{children}</div>
      </div>
    </PageContainer>
  );
}
