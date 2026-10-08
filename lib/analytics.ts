// Section events complement GA4's page views; do not send search or wallet data.
export function trackSection(section: string) {
  if (
    !["explore", "schemas", "issuers", "wallet", "lab", "guide"].includes(
      section,
    )
  )
    return;
  const analytics = window as Window & { gtag?: (...args: unknown[]) => void };
  analytics.gtag?.("event", "view_section", { section });
}
