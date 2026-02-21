import { useCallback, useEffect, useRef, useState } from "react";

const GSI_BASE = "https://accounts.google.com/gsi/client";
const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (res: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          prompt: (momentListener?: (moment: { getDismissedReason: () => string }) => void) => void;
        };
      };
    };
  }
}

function loadScript(): Promise<void> {
  if (!clientId) return Promise.reject(new Error("Missing VITE_GOOGLE_CLIENT_ID"));
  const gsiUrl = `${GSI_BASE}?client_id=${encodeURIComponent(clientId)}`;
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${GSI_BASE}"]`);
    if (existing) {
      if (window.google?.accounts?.id) return resolve();
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = gsiUrl;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

export function useGoogleAuth() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingCallback = useRef<((idToken: string) => void | Promise<void>) | null>(null);

  useEffect(() => {
    if (!clientId) {
      setError("Google Sign-In is not configured (missing VITE_GOOGLE_CLIENT_ID)");
      return;
    }
    if (!clientId.endsWith(".apps.googleusercontent.com")) {
      setError("Invalid Google Client ID: must end with .apps.googleusercontent.com (use Web application Client ID from Google Cloud Console)");
      return;
    }
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          callback: (res) => {
            const cb = pendingCallback.current;
            pendingCallback.current = null;
            if (cb && res.credential) cb(res.credential);
          },
        });
        setIsReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Google Sign-In failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithGoogle = useCallback((onCredential: (idToken: string) => void | Promise<void>) => {
    if (!clientId) {
      setError("Google Sign-In is not configured");
      return;
    }
    if (!window.google?.accounts?.id) {
      setError("Google Sign-In is not ready yet");
      return;
    }
    setError(null);
    pendingCallback.current = onCredential;
    window.google.accounts.id.prompt();
  }, []);

  return { signInWithGoogle, isReady, error };
}
