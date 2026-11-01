// PrivacyGuard — install guide for Android & iOS (+ APK packaging path).

import { useState } from "react";
import { Download, PlusSquare, Share, Smartphone, SquarePlus } from "lucide-react";
import { Modal, Segmented } from "@/components/ui";
import { getPlatform, installAvailable, promptInstall } from "@/lib/pwa";
import { useStore } from "@/lib/store";

type Tab = "android" | "ios" | "apk";

export function InstallGuide() {
  const open = useStore((s) => s.installGuideOpen);
  const close = useStore((s) => s.setInstallGuideOpen);
  if (!open) return null;
  return <GuideBody onClose={() => close(false)} />;
}

function GuideBody({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(() => (getPlatform() === "ios" ? "ios" : "android"));
  const [promptState, setPromptState] = useState<string | null>(null);

  return (
    <Modal onClose={onClose} width={560}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl grid place-items-center flex-none" style={{ background: "var(--acc-dim)", border: "1px solid color-mix(in srgb, var(--acc) 35%, transparent)" }}>
            <Smartphone size={18} style={{ color: "var(--acc)" }} />
          </div>
          <div>
            <h2 className="text-[16px] h-serif" style={{ color: "var(--tx)" }}>Install PrivacyGuard</h2>
            <p className="text-[11px] mut">Runs installed: standalone window, offline shell, on-device data only.</p>
          </div>
        </div>

        <div className="my-4">
          <Segmented value={tab} onChange={setTab} options={[{ value: "android", label: "Android" }, { value: "ios", label: "iPhone / iPad" }, { value: "apk", label: "Build APK / App Store" }]} />
        </div>

        {tab === "android" && (
          <div className="anim-fade">
            <ol className="flex flex-col gap-3">
              <Step n={1} icon={Smartphone} text={<><b style={{ color: "var(--tx)" }}>Open this app in Chrome</b> on your Android device (HTTPS or localhost).</>} />
              <Step n={2} icon={Download} text={<>Tap <b style={{ color: "var(--tx)" }}>Install app</b> below — or use Chrome's menu <b style={{ color: "var(--tx)" }}>⋮ → Install app / Add to Home screen</b>.</>} />
              <Step n={3} icon={PlusSquare} text={<>Launch from the home-screen icon. It opens fullscreen, works offline, and keeps every byte of data on the device.</>} />
            </ol>
            <button
              className="btn btn-acc w-full justify-center mt-4"
              onClick={async () => {
                if (!installAvailable()) { setPromptState("Chrome hasn't offered the install prompt yet — use menu ⋮ → Install app."); return; }
                const r = await promptInstall();
                setPromptState(r === "accepted" ? "Installed — find PrivacyGuard on your home screen." : "Prompt dismissed — you can install anytime from the ⋮ menu.");
              }}
            >
              <Download size={14} /> Install app
            </button>
            {promptState && <div className="text-[11px] info mt-2 text-center anim-fade">{promptState}</div>}
          </div>
        )}

        {tab === "ios" && (
          <div className="anim-fade">
            <div className="card p-3 mb-3" style={{ background: "var(--info-dim)", borderColor: "color-mix(in srgb, var(--info) 25%, transparent)" }}>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--tx)" }}>
                iOS installs web apps through <b>Safari</b> — Chrome on iOS cannot do this. Apple does not allow
                raw <span className="mono">.ipa</span> files to be sideloaded without App Store / TestFlight / enterprise signing;
                Add-to-Home-Screen gives you the full standalone app today.
              </p>
            </div>
            <ol className="flex flex-col gap-3">
              <Step n={1} icon={Smartphone} text={<>Open this app in <b style={{ color: "var(--tx)" }}>Safari</b> on your iPhone or iPad.</>} />
              <Step n={2} icon={Share} text={<>Tap the <b style={{ color: "var(--tx)" }}>Share</b> button (square with an up-arrow) in the toolbar.</>} />
              <Step n={3} icon={SquarePlus} text={<>Choose <b style={{ color: "var(--tx)" }}>Add to Home Screen</b>, then confirm <b style={{ color: "var(--tx)" }}>Add</b>.</>} />
              <Step n={4} icon={PlusSquare} text={<>Launch from your home screen — fullscreen standalone mode, offline capable, data on-device only.</>} />
            </ol>
          </div>
        )}

        {tab === "apk" && (
          <div className="anim-fade">
            <p className="text-[11.5px] mut leading-relaxed mb-3">
              The app ships ready for <b style={{ color: "var(--tx)" }}>Capacitor</b> (<span className="mono">capacitor.config.json</span> is
              committed). On any machine with Android Studio / Xcode, these commands produce a real signed binary:
            </p>
            <div className="logviewer card p-3.5 mb-3" style={{ background: "var(--bg0)" }}>
              <div><span className="dim"># Android APK / AAB</span></div>
              <div><span style={{ color: "var(--acc)" }}>npm install</span> && <span style={{ color: "var(--acc)" }}>npm run build</span></div>
              <div>npx cap add android &amp;&amp; npx cap sync</div>
              <div>npx cap open android <span className="dim"># → Build → Generate Signed APK/AAB</span></div>
              <div className="mt-2"><span className="dim"># iOS (macOS + Xcode + Apple Developer account)</span></div>
              <div>npx cap add ios &amp;&amp; npx cap sync &amp;&amp; npx cap open ios</div>
              <div className="dim"># → Signing & Capabilities → Release archive for App Store / TestFlight</div>
            </div>
            <p className="text-[10.5px] dim leading-relaxed">
              Environment note: this repository is built by a web toolchain — no Java/Android SDK or macOS/Xcode exists
              here, so the binary itself is produced on your machine in one command. A raw <span className="mono">.ipa</span> cannot
              be sideloaded on non-jailbroken iPhones regardless of tooling (Apple restriction), which is why the
              Safari install path above exists.
            </p>
          </div>
        )}

        <div className="flex justify-end mt-5">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

function Step({ n, icon: Icon, text }: { n: number; icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; text: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mono text-[11px] w-5 h-5 rounded-md grid place-items-center flex-none mt-0.5" style={{ background: "var(--panel2)", color: "var(--acc)", border: "1px solid var(--line)" }}>{n}</span>
      <Icon size={14} className="flex-none mt-[3px]" style={{ color: "var(--acc2)" }} />
      <span className="text-[12px] mut leading-relaxed">{text}</span>
    </li>
  );
}
