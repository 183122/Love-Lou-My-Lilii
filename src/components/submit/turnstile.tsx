"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare Turnstile widget. Calls onToken(null) when the token expires. */
export function Turnstile({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string;
  onToken: (t: string | null) => void;
  resetKey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      if (widget.current) window.turnstile.remove(widget.current);
      widget.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        language: "th",
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(null),
        "error-callback": () => cb.current(null),
      });
    };
    if (window.turnstile) mount();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
      if (!s) {
        s = document.createElement("script");
        s.src = SCRIPT;
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", mount);
    }
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, resetKey]);

  return <div ref={ref} className="min-h-[65px]" />;
}
