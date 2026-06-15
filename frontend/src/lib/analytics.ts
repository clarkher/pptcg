// Meta Pixel + GA4 analytics helpers.
// The base tags are injected in index.html (they fire the initial PageView on
// load). These helpers drive SPA route-change PageViews and funnel events from
// React, since the base pixel does not re-fire on client-side navigation.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/** Fire a PageView to Meta Pixel + GA4. Called on SPA route changes. */
export function trackPageView(
  path: string = window.location.pathname + window.location.search,
): void {
  window.fbq?.('track', 'PageView');
  window.gtag?.('event', 'page_view', { page_path: path });
}

/**
 * Fire a standard Meta Pixel event (ViewContent, AddToCart, InitiateCheckout,
 * Purchase, …). Pass `eventId` so the matching server-side Conversions API
 * event can dedupe against it via the same eventID.
 */
export function trackPixel(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  window.fbq?.('track', event, params ?? {}, eventId ? { eventID: eventId } : undefined);
}
