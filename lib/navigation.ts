export function localURL(params: Record<string,string>) { return window.location.pathname+'?'+new URLSearchParams(params).toString(); }
export function shareURL(params: Record<string,string>) { return new URL(localURL(params), window.location.origin).href; }
