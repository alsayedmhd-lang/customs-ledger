import { useEffect, useRef, useState } from "react";

type ClientOption = { id: number | string; name: string };
export default function InvoiceClientSelect({ clients, value, onChange, placeholder, className, dir, disabled = false }: {
  clients: ClientOption[]; value: string; onChange: (value: string) => void;
  placeholder: string; className?: string; disabled?: boolean; dir: "rtl" | "ltr";
}) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(180);
  const [limit, setLimit] = useState(480);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const selected = clients.find(c => String(c.id) === value);
  const rowHeight = 36;
  const actualHeight = Math.min(height, limit, clients.length * rowHeight);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const fit = () => setLimit(Math.max(36, Math.min(480, window.innerHeight - (root.current?.getBoundingClientRect().bottom ?? 0) - 40)));
    fit();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", fit);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", fit); };
  }, [open]);
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  const show = () => { setActive(Math.max(0, clients.findIndex(c => String(c.id) === value))); setOpen(true); };
  return <div ref={root} className="relative min-w-0" dir={dir}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button type="button" disabled={disabled} className={`${className ?? ""} flex items-center justify-between gap-2 text-start`}
      aria-haspopup="listbox" aria-expanded={open}
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) show();
          else setActive(i => Math.max(0, Math.min(clients.length - 1, i + (event.key === "ArrowDown" ? 1 : -1))));
        }
        if (open && event.key === "Enter") {
          event.preventDefault(); if (clients[active]) onChange(String(clients[active].id)); setOpen(false);
        }
      }}>
      <span className="min-w-0 truncate">{selected?.name || placeholder}</span>
      <span aria-hidden="true" className="shrink-0 text-muted-foreground">▾</span>
    </button>
    {open && <div className="absolute inset-x-0 top-full z-[9999] mt-1 overflow-hidden rounded-lg border border-border shadow-xl"
      style={{ backgroundColor: "hsl(var(--card, 0 0% 100%))", color: "hsl(var(--card-foreground, 222 47% 11%))" }}
      onMouseDown={event => event.preventDefault()}>
      <div ref={list} role="listbox" aria-label={dir === "rtl" ? "الخيارات" : "Options"}
        style={{ height: clients.length ? actualHeight : 36, overflowY: "scroll", scrollbarGutter: "stable", overscrollBehavior: "contain" }}>
        {clients.map((client, index) => <button type="button" role="option" key={client.id}
          aria-selected={String(client.id) === value}
          className={`block w-full truncate border-b border-border/50 px-3 text-start text-sm hover:bg-muted ${index === active ? "bg-muted" : ""}`}
          style={{ height: rowHeight, minHeight: rowHeight }} title={client.name}
          onMouseEnter={() => setActive(index)}
          onClick={() => { onChange(String(client.id)); setOpen(false); }}>
          {client.name}
        </button>)}
        {!clients.length && <p className="px-3 py-2 text-sm text-muted-foreground">{dir === "rtl" ? "لا توجد خيارات" : "No options"}</p>}
      </div>
      {!!clients.length && <div role="separator" aria-orientation="horizontal" tabIndex={0}
        aria-label={dir === "rtl" ? "اسحب لتغيير ارتفاع القائمة" : "Drag to resize list"}
        aria-valuemin={36} aria-valuemax={Math.min(limit, clients.length * rowHeight)} aria-valuenow={actualHeight}
        className="flex h-5 items-center justify-center border-t border-border bg-muted"
        style={{ cursor: "ns-resize", touchAction: "none", userSelect: "none" }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setHeight(h => Math.max(36, Math.min(limit, clients.length * rowHeight, h + (event.key === "ArrowDown" ? 36 : -36))));
          }
        }}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { y: event.clientY, height: actualHeight }; }}
        onPointerMove={event => { if (drag.current) setHeight(Math.max(36, Math.min(limit, clients.length * rowHeight, drag.current.height + event.clientY - drag.current.y))); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
        <span className="h-1 w-10 rounded-full bg-muted-foreground/50" />
      </div>}
    </div>}
  </div>;
}
