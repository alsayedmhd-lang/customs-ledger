export async function savePdf(fileName: string) {
  const safeName = fileName
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if ((window as any).electronAPI?.saveCurrentPagePDF) {
    return await (window as any).electronAPI.saveCurrentPagePDF(safeName);
  }

  const oldTitle = document.title;
  document.title = safeName;

  window.print();

  setTimeout(() => {
    document.title = oldTitle;
  }, 1000);
}
