import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';

// index.html fires the initial PageView on load, so this tracker only fires on
// subsequent SPA navigations. The module-scoped guard survives StrictMode's
// dev-mode effect double-invoke (same path → no duplicate PageView).
let lastTrackedPath: string | null = null;

export function RouteChangeTracker() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname + location.search;
    if (lastTrackedPath === null) {
      lastTrackedPath = path; // initial load — already counted by index.html
      return;
    }
    if (path === lastTrackedPath) return;
    lastTrackedPath = path;
    trackPageView(path);
  }, [location.pathname, location.search]);

  return null;
}
