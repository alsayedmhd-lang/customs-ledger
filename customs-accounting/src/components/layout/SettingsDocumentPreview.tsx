import { useState, useRef, useEffect, useId } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsDocumentPreview({
  id,
  title,
  fitLabel,
  isAR = false,
  size,
  scale,
  onScaleChange,
  activePreview,
  savedWidth,
  savedHeight,
  onSelect,
  onWidthChange,
  onHeightChange,
  onFitHeight,
  children,
}: {
  id?: string;
  title: string;
  fitLabel: string;
  isAR?: boolean;
  size: "large" | "medium" | "small";
  scale: number;
  onScaleChange?: (scale: number) => void;
  activePreview?: string;
  savedWidth?: number;
  savedHeight?: number;
  onSelect?: (id: string) => void;
  onWidthChange?: (id: string, width: number) => void;
  onHeightChange?: (id: string, height: number) => void;
  onFitHeight?: (id: string) => void;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const shellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const startSizeRef = useRef<{ width: number; height: number } | null>(null);
  const isInteractive = !!id && !!activePreview;
  const isMain = isInteractive ? id === activePreview : size === "large";
  const preview = {
    large: {
      sourceWidth: 1120,
      sourceHeight: 900,
    },
    medium: {
      sourceWidth: 840,
      sourceHeight: 700,
    },
    small: {
      sourceWidth: 840,
      sourceHeight: 720,
    },
  }[size];
  const scaledWidth = Math.ceil(preview.sourceWidth * scale);
  const [contentHeight, setContentHeight] = useState(preview.sourceHeight);
  useEffect(() => {
    const document = documentRef.current;
    if (!expanded || !document) return;
    const measure = () => setContentHeight(document.scrollHeight || preview.sourceHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document);
    return () => observer.disconnect();
  }, [preview.sourceHeight, expanded]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!expanded || !viewport || !onScaleChange) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      onScaleChange(Math.min(3, Math.max(0.5, Number((scale + (event.deltaY < 0 ? 0.1 : -0.1)).toFixed(2)))));
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [expanded, scale, onScaleChange]);
  const scaledHeight = Math.ceil(contentHeight * scale);
  const fittedHeight = Math.min(480, Math.max(260, scaledHeight + 48));
  const handleSaveSize = () => {
    if (!expanded || !shellRef.current || !id) return;
    const width = Math.round(shellRef.current.offsetWidth);
    const height = Math.round(shellRef.current.offsetHeight);
    const start = startSizeRef.current;
    startSizeRef.current = null;
    if (!start || (width === start.width && height === start.height)) return;
    if (width !== start.width) onWidthChange?.(id, width);
    if (height !== start.height) onHeightChange?.(id, height);
  };

  return (
    <div
      ref={shellRef}

      draggable={expanded && isInteractive && !isMain}
      onClick={() => expanded && id && !isMain && onSelect?.(id)}
      onDragStart={(e) => id && e.dataTransfer.setData("text/plain", id)}
      onDragOver={(e) => isMain && e.preventDefault()}
      onDrop={(e) => {
        if (!isMain) return;
        const next = e.dataTransfer.getData("text/plain");
        if (next) onSelect?.(next);
      }}
      onMouseUp={handleSaveSize}
      onTouchEnd={handleSaveSize}
      onPointerDown={() => {
        if (expanded && shellRef.current) {
          startSizeRef.current = {
            width: Math.round(shellRef.current.offsetWidth),
            height: Math.round(shellRef.current.offsetHeight),
          };
        }
      }}
      className={cn(
        "min-w-0 rounded-lg border border-border bg-muted/20 overflow-hidden",
        isInteractive && !isMain && "cursor-pointer transition hover:border-primary/60 hover:shadow-md",
        isMain && "shadow-sm"
      )}
      style={{
        order: expanded && isMain ? 0 : 1,
        flex: "0 0 auto",
        width: expanded && savedWidth ? savedWidth : "100%",
        maxWidth: "100%",
        resize: expanded ? "both" : "none",
        height: expanded ? savedHeight ?? fittedHeight : "auto",
        minHeight: expanded ? 260 : 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card shrink-0">
        <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          {expanded && savedHeight && id && (
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 hover:text-foreground"
              onClick={(event) => { event.stopPropagation(); onFitHeight?.(id); }}
            >
              {fitLabel}
            </button>
          )}
          {expanded && <span>{Math.round(scale * 100)}% · Ctrl + {isAR ? "سحب الزاوية للتحجيم" : "Drag corner to resize"}</span>}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={`${expanded ? (isAR ? "إخفاء" : "Hide") : (isAR ? "إظهار" : "Show")} ${title}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[13px] font-medium text-foreground"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              startSizeRef.current = null;
              setExpanded((current) => !current);
            }}
          >
            {expanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {expanded ? (isAR ? "إخفاء" : "Hide") : (isAR ? "إظهار" : "Show")}
          </button>
        </div>
      </div>
      {expanded && <div
        id={panelId}
        ref={viewportRef}
        className="flex-1 overflow-auto border-t border-border bg-slate-100 p-1"
        style={{

          minHeight: 0,
          maxHeight: "none",
        }}
      >
        <div
          className="relative mx-auto"
          style={{
            width: scaledWidth,
            minWidth: scaledWidth,
            minHeight: scaledHeight,
          }}
        >
          <div
            data-settings-preview ref={documentRef}
            className="absolute top-0"
            style={{
              left: (scaledWidth - preview.sourceWidth) / 2,
              width: preview.sourceWidth,
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
            {children}
          </div>
        </div>
      </div>}
    </div>
  );
}
