export const SIDEBAR_STORAGE_KEY = "maz-sidebar-collapsed";

/** Apply before first paint, just like the theme and font preferences. */
export function sidebarInitScript(): string {
  return `(function(){try{document.documentElement.dataset.sidebarCollapsed=String(localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)})==="true");}catch(e){document.documentElement.dataset.sidebarCollapsed="false";}})()`;
}
