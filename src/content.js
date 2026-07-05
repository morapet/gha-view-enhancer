/**
 * content.js
 *
 * Entry point for the GHA View Enhancer content script.
 *
 * Responsibilities:
 *  - Detect whether the current page is a GitHub Actions run summary page.
 *  - Restore persisted filter state from chrome.storage.local.
 *  - Inject the filter toolbar (once per page view).
 *  - Start a MutationObserver that re-applies the filter whenever job rows
 *    are added, removed, or changed (handles lazy-loaded / expanded rows).
 *  - Handle SPA navigation (GitHub is a Turbo/PJAX single-page app): when the
 *    URL changes, decide whether to inject/remove the toolbar accordingly.
 */

(function () {
  const ns = window.__ghaFilter;
  const { restoreState, applyFilter, injectToolbar, removeToolbar } = ns;

  // ── URL matching ─────────────────────────────────────────────────────────
  // Match any GitHub instance (github.com or GitHub Enterprise e.g. github.xyz.de).
  // We check the pathname only so the hostname doesn't matter.
  const RUN_PAGE_RE = /^\/[^/]+\/[^/]+\/actions\/runs\/[^/]+/;

  function isRunPage() {
    return RUN_PAGE_RE.test(window.location.pathname);
  }

  // ── MutationObserver with debounce ───────────────────────────────────────
  let debounceTimer = null;
  const DEBOUNCE_MS = 150;

  function onMutation() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!isRunPage()) return;
      // Re-inject toolbar if it was removed by a partial page swap.
      if (!ns.isToolbarInjected()) injectToolbar();
      applyFilter();
    }, DEBOUNCE_MS);
  }

  const observer = new MutationObserver(onMutation);

  function startObserver() {
    observer.observe(document.body, {
      childList:  true,
      subtree:    true,
      attributes: false,
    });
  }

  // ── SPA navigation handling ──────────────────────────────────────────────
  // GitHub uses history.pushState / replaceState for navigation.
  // We monkey-patch them so we can react to URL changes.

  function onNavigate() {
    if (isRunPage()) {
      // Small delay to let GitHub render the new page content.
      setTimeout(() => {
        if (!ns.isToolbarInjected()) injectToolbar();
        applyFilter();
      }, 300);
    } else {
      removeToolbar();
    }
  }

  function patchHistoryMethod(method) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event("__ghaNavigation"));
      return result;
    };
  }

  // Only patch once (guard for HMR / multiple script injections).
  if (!window.__ghaHistoryPatched) {
    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");
    window.addEventListener("popstate", () =>
      window.dispatchEvent(new Event("__ghaNavigation"))
    );
    window.__ghaHistoryPatched = true;
  }

  window.addEventListener("__ghaNavigation", onNavigate);

  // ── Initialisation ───────────────────────────────────────────────────────
  function init() {
    if (!isRunPage()) return;

    restoreState(() => {
      injectToolbar();
      applyFilter();
      startObserver();
    });
  }

  // Run on first load.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
