/**
 * Reliable outbound navigation for affiliate destinations.
 *
 * Every shop button in MUIRO awaits a tracking request (`POST /api/click`)
 * before opening the merchant, and that is exactly where clicks were being
 * lost: `window.open()` is only honoured when it runs synchronously inside the
 * user's click gesture. Once the handler has yielded to `await`, the browser
 * may treat the call as script-initiated and refuse it -- returning `null` and
 * opening nothing at all. Three of the four shop buttons had no fallback
 * after that call, so a blocked popup meant the click silently did nothing.
 *
 * The fourth (ProductCard) checked `if (!win)`, but passing `noopener` in the
 * features string makes `window.open` return `null` *even when it succeeds*,
 * so that branch fired every time and navigated the current tab away,
 * dumping the shopper out of the lookbook.
 *
 * Strategy: open the tab now, while the gesture is still live, then fill it
 * in with the server-validated URL once tracking resolves.
 *
 * - `noopener` is applied by nulling `opener` instead of passing it in the
 *   features string, so we keep a handle on the window we just opened.
 * - If the popup is still refused (strict blockers), fall back to navigating
 *   this tab, which is never blocked -- the shopper always reaches the
 *   merchant rather than clicking into nothing.
 *
 * IMPORTANT: call `beginAffiliateNavigation()` directly in the click handler,
 * before any `await`.
 */
export function beginAffiliateNavigation(): (url: string) => void {
  let popup: Window | null = null;

  try {
    popup = window.open('about:blank', '_blank');
  } catch {
    popup = null;
  }

  if (popup) {
    try {
      // Same protection the `noopener` feature string would have given us.
      popup.opener = null;
    } catch {
      // Window already isolated by the browser.
    }

    return (url: string) => {
      try {
        popup.location.href = url;
      } catch {
        // Cross-origin or closed: navigate this tab instead.
        window.location.href = url;
      }
    };
  }

  // Popup refused: in-tab navigation cannot be blocked.
  return (url: string) => {
    window.location.href = url;
  };
}
