"use client";

import { useEffect } from "react";

export function VisitTracker() {
  useEffect(() => {
    const key = `wally-viewed:${location.pathname}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    let referrerHost: string | null = null;
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      referrerHost = referrer && referrer.host !== location.host ? referrer.host : null;
    } catch { /* Ignore malformed referrers. */ }
    void fetch("/api/analytics/visits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pagePath: location.pathname, referrerHost }), keepalive: true });
  }, []);
  return null;
}
