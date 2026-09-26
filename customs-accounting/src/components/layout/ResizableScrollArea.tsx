import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  maxHeight: number;
  storageKey: string;
  minHeight?: number;
  maxDragHeight?: number;
};

export default function ResizableScrollArea({
  children,
  className,
  maxHeight,
  storageKey,
  minHeight = 160,
  maxDragHeight = 1600,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; height: number } | null>(null);
  const [height, setHeight] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem(`scroll-height:${storageKey}`));
      return Number.isFinite(saved) && saved >= minHeight ? saved : null;
    } catch {
      return null;
    }
  });

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!areaRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { y: event.clientY, height: areaRef.current.offsetHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const next = Math.min(maxDragHeight, Math.max(minHeight, dragRef.current.height + event.clientY - dragRef.current.y));
    setHeight(next);
  };

  const stopDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const next = Math.min(maxDragHeight, Math.max(minHeight, dragRef.current.height + event.clientY - dragRef.current.y));
    dragRef.current = null;
    setHeight(next);
    try { localStorage.setItem(`scroll-height:${storageKey}`, String(next)); } catch {}
  };

  return (
    <div className="min-w-0">
      <div
        ref={areaRef}
        className={cn("overflow-x-auto overflow-y-auto", className)}
        style={height === null ? { maxHeight } : { height }}
      >
        {children}
      </div>
      <div className="flex h-7 items-center justify-center border-t border-border/50">
        <button
          type="button"
          aria-label="اسحب لتغيير ارتفاع الحاوية / Drag to resize panel height"
          title="اسحب لأسفل لزيادة ارتفاع الحاوية / Drag down to enlarge"
          className="group flex h-7 w-24 touch-none cursor-ns-resize items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <span aria-hidden="true" className="w-14 border-t-2 border-dashed border-muted-foreground/50 transition-colors group-hover:border-primary group-focus-visible:border-primary" />
        </button>
      </div>
    </div>
  );
}
