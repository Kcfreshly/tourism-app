// Tells the toaster (src/components/toast.tsx) that a navigation started, so
// a slow one can say where it is going. Covers links, router.push/replace
// and back/forward. No imports: this file runs before hydration on every page.
export function onRouterTransitionStart(url: string) {
  window.dispatchEvent(new CustomEvent("app-navigation", { detail: url }));
}
