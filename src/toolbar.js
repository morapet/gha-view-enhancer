/**
 * toolbar.js
 *
 * Builds and injects the filter toolbar into the GitHub Actions run page.
 * Wires checkbox and button events to the filter module.
 *
 * The toolbar uses only inline/custom styles and data attributes — no
 * GitHub-internal CSS class names — so it is resilient to GitHub UI changes.
 */

(function () {
  const ns = window.__ghaFilter;
  const { STATUS, showAll, showOnly, setStatusVisible } = ns;

  const TOOLBAR_ID = "gha-filter-toolbar";

  // Human-readable labels for each status.
  const STATUS_LABELS = {
    [STATUS.SUCCESS]:     "✅ Success",
    [STATUS.FAILURE]:     "❌ Failure",
    [STATUS.SKIPPED]:     "⏭ Skipped",
    [STATUS.CANCELLED]:   "🚫 Cancelled",
    [STATUS.IN_PROGRESS]: "🔄 In progress",
  };

  // Ordered list for consistent rendering.
  const STATUS_ORDER = [
    STATUS.SUCCESS,
    STATUS.FAILURE,
    STATUS.SKIPPED,
    STATUS.CANCELLED,
    STATUS.IN_PROGRESS,
  ];

  /**
   * Return true if the toolbar is already injected into the document.
   */
  function isInjected() {
    return !!document.getElementById(TOOLBAR_ID);
  }

  /**
   * Remove the toolbar from the DOM (used on SPA navigation away from run pages).
   */
  function removeToolbar() {
    const el = document.getElementById(TOOLBAR_ID);
    if (el) el.remove();
  }

  /**
   * Sync checkbox states to the current ns.activeStatuses.
   * Called after the filter state is restored from storage or changed externally.
   */
  function syncCheckboxes() {
    const toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) return;
    for (const status of STATUS_ORDER) {
      const cb = toolbar.querySelector(`[data-gha-status="${status}"]`);
      if (cb) cb.checked = ns.activeStatuses.has(status);
    }
  }

  /**
   * Build and inject the toolbar.  Guard against double-injection.
   *
   * @param {Element} [container] — Optional element to prepend the toolbar to.
   *   If omitted the toolbar is prepended to document.body as a floating bar.
   */
  function injectToolbar() {
    if (isInjected()) return;

    const toolbar = document.createElement("div");
    toolbar.id = TOOLBAR_ID;
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "GHA filter toolbar");

    // ── Title ────────────────────────────────────────────────────────────
    const title = document.createElement("span");
    title.className = "gha-filter-title";
    title.textContent = "Filter jobs:";
    toolbar.appendChild(title);

    // ── Checkboxes ───────────────────────────────────────────────────────
    const checkboxGroup = document.createElement("span");
    checkboxGroup.className = "gha-filter-checkboxes";

    for (const status of STATUS_ORDER) {
      const label = document.createElement("label");
      label.className = "gha-filter-label";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = ns.activeStatuses.has(status);
      cb.dataset.ghaStatus = status;
      cb.addEventListener("change", () => {
        setStatusVisible(status, cb.checked);
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + STATUS_LABELS[status]));
      checkboxGroup.appendChild(label);
    }
    toolbar.appendChild(checkboxGroup);

    // ── Buttons ──────────────────────────────────────────────────────────
    const btnGroup = document.createElement("span");
    btnGroup.className = "gha-filter-buttons";

    const onlyFailBtn = document.createElement("button");
    onlyFailBtn.className = "gha-filter-btn";
    onlyFailBtn.textContent = "Only failures";
    onlyFailBtn.title = "Show only failed jobs";
    onlyFailBtn.addEventListener("click", () => {
      showOnly(STATUS.FAILURE);
      syncCheckboxes();
    });
    btnGroup.appendChild(onlyFailBtn);

    const showAllBtn = document.createElement("button");
    showAllBtn.className = "gha-filter-btn gha-filter-btn--secondary";
    showAllBtn.textContent = "Show all";
    showAllBtn.title = "Reset filter — show all jobs";
    showAllBtn.addEventListener("click", () => {
      showAll();
      syncCheckboxes();
    });
    btnGroup.appendChild(showAllBtn);

    toolbar.appendChild(btnGroup);

    // Register state-change callback so external changes keep checkboxes in sync.
    ns.onStateChange = syncCheckboxes;

    // ── Inject ───────────────────────────────────────────────────────────
    // Try to find a sensible anchor point in the GitHub UI.  Fall back to
    // prepending to <body> as a fixed banner if we can't find one.
    //
    // ⚠️  The selectors below target GitHub's run-page layout.  They may need
    //     updating if GitHub changes its page structure.
    const anchor =
      document.querySelector('[data-testid="workflow-run-jobs-list"]') ||
      document.querySelector(".js-check-suite-header") ||
      document.querySelector("main") ||
      document.body;

    anchor.insertBefore(toolbar, anchor.firstChild);
  }

  ns.injectToolbar   = injectToolbar;
  ns.removeToolbar   = removeToolbar;
  ns.isToolbarInjected = isInjected;
  ns.syncCheckboxes  = syncCheckboxes;
})();
