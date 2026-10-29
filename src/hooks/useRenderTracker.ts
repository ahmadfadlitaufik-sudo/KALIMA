import { useRef, useEffect } from 'react';

export interface RenderChangeDetail {
  key: string;
  previous: any;
  current: any;
  isReferenceOnlyChange: boolean; // prev !== next, but deepEqual(prev, next) === true
}

export interface RenderTraceEvent {
  componentName: string;
  renderCount: number;
  timestamp: string;
  timeSinceLastRenderMs: number;
  changes: RenderChangeDetail[];
  hasUnnecessaryReferenceChanges: boolean;
}

// In-memory trace history accessible for dev tools & logging inspection
declare global {
  interface Window {
    __RENDER_TRACES__?: Record<string, RenderTraceEvent[]>;
    __GET_RENDER_STATS__?: (componentName?: string) => void;
  }
}

if (typeof window !== 'undefined') {
  if (!window.__RENDER_TRACES__) {
    window.__RENDER_TRACES__ = {};
  }
  window.__GET_RENDER_STATS__ = (componentName?: string) => {
    const traces = window.__RENDER_TRACES__ || {};
    if (componentName) {
      const history = traces[componentName] || [];
      console.table(
        history.map((h) => ({
          'Render #': h.renderCount,
          Time: h.timestamp,
          'Diff (ms)': h.timeSinceLastRenderMs,
          'Changed Keys': h.changes.map((c) => c.key).join(', ') || '(first render)',
          'Ref Leaks': h.hasUnnecessaryReferenceChanges ? '⚠️ YES' : 'NONE',
        }))
      );
    } else {
      console.log('Available tracked components:', Object.keys(traces));
      Object.keys(traces).forEach((name) => {
        const events = traces[name];
        console.log(
          `• ${name}: ${events.length} renders recorded (Last: ${
            events[events.length - 1]?.timestamp || '-'
          })`
        );
      });
    }
  };
}

/**
 * Fast deep equality check for tracking if an object/array reference changed without data changes.
 */
function isDeepEqual(obj1: any, obj2: any): boolean {
  if (Object.is(obj1, obj2)) return true;
  if (
    typeof obj1 !== 'object' ||
    obj1 === null ||
    typeof obj2 !== 'object' ||
    obj2 === null
  ) {
    return false;
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!isDeepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(obj2, key)) return false;
    if (!isDeepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

/**
 * Re-render cycle tracer hook & logging middleware.
 * Verifies if parent components or hooks pass new object/array references that trigger unnecessary re-renders.
 */
export function useRenderTracker(
  componentName: string,
  trackedValues: Record<string, any>,
  options: { enabled?: boolean; logToConsole?: boolean } = { enabled: true, logToConsole: true }
) {
  const { enabled = true, logToConsole = true } = options;
  const renderCountRef = useRef(0);
  const prevValuesRef = useRef<Record<string, any>>({});
  const lastRenderTimeRef = useRef<number>(Date.now());

  renderCountRef.current += 1;
  const renderCount = renderCountRef.current;
  const now = Date.now();
  const timeSinceLastRender = renderCount === 1 ? 0 : now - lastRenderTimeRef.current;
  lastRenderTimeRef.current = now;

  const changes: RenderChangeDetail[] = [];
  let hasUnnecessaryReferenceChanges = false;

  if (renderCount > 1) {
    const allKeys = new Set([
      ...Object.keys(prevValuesRef.current),
      ...Object.keys(trackedValues),
    ]);

    for (const key of allKeys) {
      const prev = prevValuesRef.current[key];
      const current = trackedValues[key];

      if (!Object.is(prev, current)) {
        const isRefOnly =
          typeof prev === 'object' &&
          prev !== null &&
          typeof current === 'object' &&
          current !== null &&
          isDeepEqual(prev, current);

        if (isRefOnly) {
          hasUnnecessaryReferenceChanges = true;
        }

        changes.push({
          key,
          previous: prev,
          current,
          isReferenceOnlyChange: isRefOnly,
        });
      }
    }
  }

  // Update previous values reference for next render
  prevValuesRef.current = { ...trackedValues };

  // Record trace event into global repository
  const traceEvent: RenderTraceEvent = {
    componentName,
    renderCount,
    timestamp: new Date().toLocaleTimeString(),
    timeSinceLastRenderMs: timeSinceLastRender,
    changes,
    hasUnnecessaryReferenceChanges,
  };

  if (typeof window !== 'undefined' && window.__RENDER_TRACES__) {
    if (!window.__RENDER_TRACES__[componentName]) {
      window.__RENDER_TRACES__[componentName] = [];
    }
    window.__RENDER_TRACES__[componentName].push(traceEvent);
    // Keep max 50 trace events in memory to prevent memory leaks
    if (window.__RENDER_TRACES__[componentName].length > 50) {
      window.__RENDER_TRACES__[componentName].shift();
    }
  }

  // Console output
  useEffect(() => {
    if (!enabled || !logToConsole) return;

    if (renderCount === 1) {
      console.log(
        `%c[RenderTracker] %c${componentName}%c: Initial Mount (Render #1)`,
        'color: #0ea5e9; font-weight: bold;',
        'color: #f59e0b; font-weight: bold;',
        'color: #64748b;'
      );
      return;
    }

    if (changes.length === 0) {
      console.log(
        `%c[RenderTracker] %c${componentName}%c: Render #${renderCount} (+${timeSinceLastRender}ms) - State change or parent re-render without tracked value differences.`,
        'color: #0ea5e9; font-weight: bold;',
        'color: #f59e0b; font-weight: bold;',
        'color: #64748b;'
      );
      return;
    }

    const titleStyle = hasUnnecessaryReferenceChanges
      ? 'color: #ef4444; font-weight: bold;'
      : 'color: #0ea5e9; font-weight: bold;';

    console.groupCollapsed(
      `%c[RenderTracker] %c${componentName}%c: Render #${renderCount} (+${timeSinceLastRender}ms) - ${changes.length} changed properties ${
        hasUnnecessaryReferenceChanges ? '⚠️ [UNNECESSARY NEW REFERENCE DETECTED]' : ''
      }`,
      titleStyle,
      'color: #f59e0b; font-weight: bold;',
      'color: #64748b;'
    );

    changes.forEach((c) => {
      if (c.isReferenceOnlyChange) {
        console.warn(
          `⚠️ [Unnecessary Reference]: "${c.key}" received a NEW object/array reference on re-render, but its content is DEEPLY IDENTICAL. Wrap in useMemo/useCallback or stabilize reference.`,
          { previous: c.previous, current: c.current }
        );
      } else {
        console.log(`ℹ️ [Value Changed]: "${c.key}"`, {
          previous: c.previous,
          current: c.current,
        });
      }
    });

    console.groupEnd();
  });

  return {
    renderCount,
    changes,
    hasUnnecessaryReferenceChanges,
  };
}
