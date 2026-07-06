/**
 * statusDetector.js
 *
 * Centralized status-detection logic for GitHub Actions job rows.
 *
 * ⚠️  MAINTENANCE NOTE ⚠️
 * GitHub's DOM markup is not a public API and changes without notice.
 * All selectors and string-matching heuristics live here so that updates
 * are made in one place only.  If the extension stops working after a GitHub
 * UI change, start your investigation in this file.
 *
 * Detection strategy (highest to lowest priority):
 *   1. aria-label on the row or any descendant element
 *   2. SVG <title> text / aria-label on status icon elements
 *   3. Visible status text inside the row
 *
 * If detection fails the function returns "unknown".  Unknown rows are NEVER
 * hidden so that users always see rows we cannot classify.
 */

// ---------------------------------------------------------------------------
// STATUS CONSTANTS — canonical names used throughout the extension
// ---------------------------------------------------------------------------
const STATUS = {
  SUCCESS:     "success",
  FAILURE:     "failure",
  SKIPPED:     "skipped",
  CANCELLED:   "cancelled",
  IN_PROGRESS: "in_progress",
  UNKNOWN:     "unknown",
};

// ---------------------------------------------------------------------------
// ARIA-LABEL PATTERNS
// Map substrings found in aria-label text → canonical status.
// Order matters: put more-specific patterns before more-general ones.
//
// ⚠️  These strings come from GitHub's accessibility attributes and may change.
// ---------------------------------------------------------------------------
const ARIA_LABEL_PATTERNS = [
  // Success variants
  { pattern: /completed successfully/i, status: STATUS.SUCCESS },
  { pattern: /\bsuccess\b/i,            status: STATUS.SUCCESS },
  { pattern: /\bpassed\b/i,             status: STATUS.SUCCESS },

  // Failure variants
  { pattern: /\bfailed\b/i,             status: STATUS.FAILURE },
  { pattern: /\bfailure\b/i,            status: STATUS.FAILURE },
  { pattern: /completed with errors/i,  status: STATUS.FAILURE },

  // Skipped
  { pattern: /\bskipped\b/i,            status: STATUS.SKIPPED },

  // Cancelled
  { pattern: /\bcancelled\b/i,          status: STATUS.CANCELLED },
  { pattern: /\bcanceled\b/i,           status: STATUS.CANCELLED },

  // In-progress / queued / waiting
  { pattern: /\bin progress\b/i,        status: STATUS.IN_PROGRESS },
  { pattern: /\bqueued\b/i,             status: STATUS.IN_PROGRESS },
  { pattern: /\bwaiting\b/i,            status: STATUS.IN_PROGRESS },
  { pattern: /\bpending\b/i,            status: STATUS.IN_PROGRESS },
  { pattern: /\bstarting\b/i,           status: STATUS.IN_PROGRESS },
];

// ---------------------------------------------------------------------------
// SVG OCTICON / TITLE PATTERNS
// GitHub uses SVG icons whose <title> element or aria-label describes the
// status.  We also check common octicon class names as a fallback.
//
// ⚠️  Icon names / titles may change when GitHub updates its design system.
// ---------------------------------------------------------------------------
const SVG_TITLE_PATTERNS = [
  { pattern: /\bcheck\b/i,              status: STATUS.SUCCESS  },
  { pattern: /\bcheckmark\b/i,          status: STATUS.SUCCESS  },
  { pattern: /\bx\b/i,                  status: STATUS.FAILURE  },
  { pattern: /\bskip\b/i,               status: STATUS.SKIPPED  },
  { pattern: /\bstop\b/i,               status: STATUS.CANCELLED },
  { pattern: /\bdot[\s-]fill\b/i,       status: STATUS.IN_PROGRESS },
  { pattern: /\bspinner\b/i,            status: STATUS.IN_PROGRESS },
  { pattern: /\bclock\b/i,              status: STATUS.IN_PROGRESS },
];

// ---------------------------------------------------------------------------
// VISIBLE TEXT PATTERNS (last resort)
// ⚠️  GitHub may internationalise or change these strings.
// ---------------------------------------------------------------------------
const TEXT_PATTERNS = [
  { pattern: /\bsuccess\b/i,            status: STATUS.SUCCESS  },
  { pattern: /\bfailed\b/i,             status: STATUS.FAILURE  },
  { pattern: /\bfailure\b/i,            status: STATUS.FAILURE  },
  { pattern: /\bskipped\b/i,            status: STATUS.SKIPPED  },
  { pattern: /\bcancell?ed\b/i,         status: STATUS.CANCELLED },
  { pattern: /\bin progress\b/i,        status: STATUS.IN_PROGRESS },
  { pattern: /\bqueued\b/i,             status: STATUS.IN_PROGRESS },
];

// ---------------------------------------------------------------------------
// JOB ROW SELECTOR (CSS fallback)
// Used only when the primary link-based findJobRows() approach yields nothing.
//
// ⚠️  This selector targets list items that contain a link to a job. GitHub
// frequently changes its DOM structure; update this if rows stop being found.
//
// NOTE: [data-testid*="job"] is intentionally excluded here because it is
// too broad — it also matches container elements such as
// data-testid="workflow-run-jobs-list", causing the entire job list to be
// hidden when that container's status is filtered out.
// ---------------------------------------------------------------------------
const JOB_ROW_SELECTOR =
  // Sidebar job list items — GitHub currently renders these as <li> with a
  // child anchor whose href contains "/actions/runs/".
  'li[class*="job"], ' +
  'li:has(a[href*="/actions/runs/"][href*="/job/"])';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Match text against an array of {pattern, status} entries.
 * Returns the status of the first match, or null if none matched.
 *
 * @param {string} text
 * @param {Array<{pattern: RegExp, status: string}>} patterns
 * @returns {string|null}
 */
function matchPatterns(text, patterns) {
  if (!text) return null;
  for (const { pattern, status } of patterns) {
    if (pattern.test(text)) return status;
  }
  return null;
}

/**
 * Collect all aria-label values from an element and its descendants (shallow
 * traversal limited to `maxDepth` to avoid performance issues on large DOMs).
 *
 * @param {Element} el
 * @param {number} [maxDepth=5]
 * @returns {string}
 */
function collectAriaLabels(el, maxDepth = 5) {
  const labels = [];
  function traverse(node, depth) {
    if (depth > maxDepth) return;
    const label = node.getAttribute && node.getAttribute("aria-label");
    if (label) labels.push(label);
    for (const child of node.children || []) traverse(child, depth + 1);
  }
  traverse(el, 0);
  return labels.join(" ");
}

/**
 * Collect SVG title texts and aria-labels from SVG elements inside `el`.
 *
 * @param {Element} el
 * @returns {string}
 */
function collectSvgText(el) {
  const parts = [];
  for (const svg of el.querySelectorAll("svg")) {
    const titleEl = svg.querySelector("title");
    if (titleEl && titleEl.textContent) parts.push(titleEl.textContent);
    const ariaLabel = svg.getAttribute("aria-label");
    if (ariaLabel) parts.push(ariaLabel);
    // Also check class names for common octicon patterns
    const cls = svg.getAttribute("class") || "";
    parts.push(cls);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the status of a single job row element.
 *
 * @param {Element} rowEl  — A job row element (matched by JOB_ROW_SELECTOR).
 * @returns {string}       — One of the STATUS constants.
 */
function detectRowStatus(rowEl) {
  // 1. aria-label scan
  const ariaText = collectAriaLabels(rowEl);
  const ariaStatus = matchPatterns(ariaText, ARIA_LABEL_PATTERNS);
  if (ariaStatus) return ariaStatus;

  // 2. SVG title / icon scan
  const svgText = collectSvgText(rowEl);
  const svgStatus = matchPatterns(svgText, SVG_TITLE_PATTERNS);
  if (svgStatus) return svgStatus;

  // 3. Visible text (innerText strips hidden elements)
  const visibleText = rowEl.innerText || rowEl.textContent || "";
  const textStatus = matchPatterns(visibleText, TEXT_PATTERNS);
  if (textStatus) return textStatus;

  return STATUS.UNKNOWN;
}

/**
 * Return all job row elements currently present in the document.
 *
 * Primary strategy: locate every anchor that links to an individual job page
 * (href contains both "/actions/runs/" and "/job/"), then walk up the DOM to
 * find the nearest single-job container element for each link.
 *
 * This approach works for BOTH:
 *  - the sidebar job list (links inside <li> elements), AND
 *  - the visual workflow matrix / graph (links inside <div> or other elements).
 *
 * It also avoids accidentally matching container elements such as
 * [data-testid="workflow-run-jobs-list"] that wrap all jobs at once — which
 * was the root cause of "uncheck Success → everything disappears".
 *
 * @returns {Element[]}
 */
function findJobRows() {
  const seenContainers = new Set();
  const rows = [];

  // Find every anchor that points to an individual job detail page.
  const jobLinks = document.querySelectorAll(
    'a[href*="/actions/runs/"][href*="/job/"]'
  );

  for (const link of jobLinks) {
    // Walk up to find the nearest element that represents a single job.
    // We check common structural roles/tags; if none matches we fall back
    // to the direct parent so that div-based matrix cells are also captured.
    const container =
      link.closest("li") ||
      link.closest('[role="listitem"]') ||
      link.closest('[role="treeitem"]') ||
      link.closest("article") ||
      link.parentElement;

    if (!container || container === document.body) continue;

    if (!seenContainers.has(container)) {
      seenContainers.add(container);
      rows.push(container);
    }
  }

  // Fallback: if the page has no job links yet (e.g. still loading) try the
  // CSS selector approach.
  if (rows.length === 0) {
    try {
      return Array.from(document.querySelectorAll(JOB_ROW_SELECTOR));
    } catch (_err) {
      return Array.from(document.querySelectorAll("li[class*='job']"));
    }
  }

  return rows;
}

// Expose via simple globals (content scripts share the page JS scope).
// We namespace under `window.__ghaFilter` to avoid collisions.
window.__ghaFilter = window.__ghaFilter || {};
window.__ghaFilter.STATUS            = STATUS;
window.__ghaFilter.detectRowStatus   = detectRowStatus;
window.__ghaFilter.findJobRows       = findJobRows;
window.__ghaFilter.JOB_ROW_SELECTOR  = JOB_ROW_SELECTOR;
