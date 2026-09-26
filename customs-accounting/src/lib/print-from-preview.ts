export function printFromPreview() {
  const electronPrint = (window as any).electronAPI?.printExternalPreview;
  if (typeof electronPrint === "function") {
    void electronPrint().then((handled: boolean) => {
      if (!handled) window.print();
    }).catch(() => window.print());
    return;
  }
  window.print();
}
