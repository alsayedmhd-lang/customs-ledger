import { useEffect, useRef } from "react";

/** Protect local form edits without persisting sensitive form contents. */
export function useUnsavedChanges(dirty: boolean, isAR: boolean) {
  const state = useRef({ dirty, isAR });
  state.current = { dirty, isAR };
  const markChangesSaved = () => { state.current.dirty = false; };

  useEffect(() => {
    let currentUrl = window.location.href;
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const message = () => state.current.isAR
      ? "توجد تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟"
      : "You have unsaved changes. Leave without saving?";
    const allow = () => {
      if (!state.current.dirty) return true;
      if (!window.confirm(message())) return false;
      state.current.dirty = false;
      return true;
    };
    const changesPage = (url?: string | URL | null) =>
      url != null && new URL(String(url), location.href).href !== currentUrl;
    const push: History["pushState"] = function(data, unused, url) {
      if (changesPage(url) && !allow()) return;
      originalPush.call(history, data, unused, url);
      currentUrl = location.href;
    };
    const replace: History["replaceState"] = function(data, unused, url) {
      if (changesPage(url) && !allow()) return;
      originalReplace.call(history, data, unused, url);
      currentUrl = location.href;
    };
    history.pushState = push;
    history.replaceState = replace;
    const onPop = (event: PopStateEvent) => {
      if (location.href === currentUrl) return;
      if (!allow()) {
        event.stopImmediatePropagation();
        originalPush.call(history, null, "", currentUrl);
        return;
      }
      currentUrl = location.href;
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!state.current.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", onPop, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace) history.replaceState = originalReplace;
      window.removeEventListener("popstate", onPop, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);
  return { markChangesSaved };
}
