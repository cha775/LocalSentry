// PrivacyGuard — PWA / Android install plumbing.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function initPwa() {
  // capture the Android install prompt (Chrome/Edge on Android)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("pg-installable"));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event("pg-installable"));
  });

  // offline shell cache — only when actually served over http(s)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* hosted as a bare file — skipping shell cache */
    });
  }
}

export function installAvailable(): boolean {
  return deferredPrompt !== null;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const p = deferredPrompt;
  deferredPrompt = null;
  await p.prompt();
  const choice = await p.userChoice;
  window.dispatchEvent(new Event("pg-installable"));
  return choice.outcome;
}

export function onInstallableChange(cb: () => void): () => void {
  window.addEventListener("pg-installable", cb);
  return () => window.removeEventListener("pg-installable", cb);
}

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function getPlatform(): "android" | "ios" | "desktop" {
  return isIOS() ? "ios" : isAndroid() ? "android" : "desktop";
}
