import CompactSettingsStyle from "./CompactSettingsStyle";
import { useEffect, useRef, type ReactNode } from "react";
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
  tabsSticky = true,
}: SettingsShellProps<T>) {
  const resolvedDir = dir ?? "ltr";
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;
    const initializeSections = () => {
      const sections = Array.from(root.querySelectorAll<HTMLDetailsElement>("details"))
        .filter(section => !section.parentElement?.closest("details"));
      const firstVisible = sections.find(section => !section.closest("[hidden]"));
      sections.forEach(section => { section.open = section === firstVisible; });
    };
    initializeSections();
    const observer = new MutationObserver(initializeSections);
    observer.observe(root, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
    return () => observer.disconnect();
  }, [activeTab]);

  return (
    <PageContainer dir={resolvedDir} className={className}>
      <div ref={shellRef} className="space-y-3" dir={resolvedDir} data-settings-shell={resolvedDir} data-compact-settings>
        <CompactSettingsStyle />
        <div className="rounded-xl border border-border/60 bg-card/95 p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 text-start">
              {headerMeta && <div className="mb-2">{headerMeta}</div>}
              <h1 className="text-[18px] leading-6 font-bold tracking-normal text-foreground">{title}</h1>
              {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center justify-start gap-2">{actions}</div>}
          </div>
        </div>

        <div
          className={cn(
            "z-20 rounded-xl border border-border/60 bg-card/95 p-2 shadow-sm backdrop-blur",
            tabsSticky && "sticky top-2"
          )}
        >
          <nav
            className="flex max-w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap scroll-px-2 pb-0.5 text-start overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            dir={resolvedDir}
            aria-label={resolvedDir === "rtl" ? "تبويبات الإعدادات" : "Settings tabs"}
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
                    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold leading-none transition",
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

        <div data-settings-controls className={cn("min-w-0 space-y-3", contentClassName)}>{children}</div>
      </div>
    </PageContainer>
  );
}
