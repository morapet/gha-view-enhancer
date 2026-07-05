/**
 * filter.js
 *
 * Applies / resets status-based visibility filtering over job rows.
 * Reads the current filter state from window.__ghaFilter.activeStatuses
 * (a Set of STATUS values that should be VISIBLE).
 *
 * Rows whose status is STATUS.UNKNOWN are never hidden.
 */

(function () {
  const ns = window.__ghaFilter;
  const { STATUS, detectRowStatus, findJobRows } = ns;

  // All statuses shown by default.
  const ALL_STATUSES = new Set([
    STATUS.SUCCESS,
    STATUS.FAILURE,
    STATUS.SKIPPED,
    STATUS.CANCELLED,
    STATUS.IN_PROGRESS,
  ]);

  // Active statuses — rows with these statuses are visible.
  // Initialised to show everything; restored from storage in content.js.
  ns.activeStatuses = new Set(ALL_STATUSES);

  /**
   * Apply the current filter to every job row currently in the DOM.
   * Rows with unknown status are always left visible.
   */
  function applyFilter() {
    const rows = findJobRows();
    for (const row of rows) {
      const status = detectRowStatus(row);
      if (status === STATUS.UNKNOWN) {
        // Never hide rows we can't classify.
        row.style.display = "";
      } else if (ns.activeStatuses.has(status)) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    }
  }

  /**
   * Reset the filter so all statuses are visible.
   */
  function showAll() {
    ns.activeStatuses = new Set(ALL_STATUSES);
    applyFilter();
    persistState();
    ns.onStateChange && ns.onStateChange();
  }

  /**
   * Show only jobs with the given statuses (varargs of STATUS values).
   */
  function showOnly(...statuses) {
    ns.activeStatuses = new Set(statuses);
    applyFilter();
    persistState();
    ns.onStateChange && ns.onStateChange();
  }

  /**
   * Toggle a single status on or off.
   *
   * @param {string} status  — One of the STATUS constants.
   * @param {boolean} visible — Whether rows with this status should be shown.
   */
  function setStatusVisible(status, visible) {
    if (visible) {
      ns.activeStatuses.add(status);
    } else {
      ns.activeStatuses.delete(status);
    }
    applyFilter();
    persistState();
    ns.onStateChange && ns.onStateChange();
  }

  /**
   * Persist current activeStatuses to chrome.storage.local so selections
   * survive SPA navigations within the same session.
   */
  function persistState() {
    try {
      const value = Array.from(ns.activeStatuses);
      chrome.storage.local.set({ ghaFilterStatuses: value });
    } catch (_e) {
      // storage not available (e.g. during unit tests) — ignore.
    }
  }

  /**
   * Restore previously persisted state.  Calls `callback` when done.
   *
   * @param {Function} callback
   */
  function restoreState(callback) {
    try {
      chrome.storage.local.get({ ghaFilterStatuses: null }, (result) => {
        if (result.ghaFilterStatuses && Array.isArray(result.ghaFilterStatuses)) {
          ns.activeStatuses = new Set(result.ghaFilterStatuses);
        }
        callback && callback();
      });
    } catch (_e) {
      callback && callback();
    }
  }

  ns.ALL_STATUSES    = ALL_STATUSES;
  ns.applyFilter     = applyFilter;
  ns.showAll         = showAll;
  ns.showOnly        = showOnly;
  ns.setStatusVisible = setStatusVisible;
  ns.persistState    = persistState;
  ns.restoreState    = restoreState;
})();
