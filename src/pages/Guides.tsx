import { useState } from "react";
import { BrainCircuit, Check, Copy, Shield, Smartphone, Sparkles, Wifi } from "lucide-react";
import { Card, PageHeader, Segmented } from "@/components/ui";
import { useStore } from "@/lib/store";

type Tab = "dns" | "ads" | "sharing" | "ai";

/* Device-wide DNS ad blocking: real, free, no-signup resolvers that filter ads and
   trackers for EVERY app on the phone — not just the browser. */
const DNS_PROVIDERS = [
  { name: "AdGuard DNS", host: "dns.adguard-dns.com", ipv4: "94.140.14.14", note: "Blocks ads, trackers and malware. Free, no account." },
  { name: "ControlD (block ads)", host: "p2.freedns.controld.com", ipv4: "76.76.2.2", note: "Ads + trackers filtering profile." },
  { name: "Mullvad (ad blocking)", host: "adblock.dns.mullvad.net", ipv4: "194.242.2.3", note: "No-logging policy, ad + tracker filter." },
  { name: "Quad9 (security only)", host: "dns.quad9.net", ipv4: "9.9.9.9", note: "Malware/phishing blocking, keeps ads." },
];

export function Guides() {
  const [tab, setTab] = useState<Tab>("dns");
  const notify = useStore((s) => s.notify);
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => notify({ kind: "ok", title: "Copied", body: text }),
      () => notify({ kind: "warn", title: "Copy failed", body: `Type it manually: ${text}` })
    );
  };

  return (
    <>
      <PageHeader
        title="Privacy Guides"
        sub="Step-by-step changes that genuinely reduce data sharing — on the phone itself, in your accounts, and in AI tools. Every step is a setting you control; PrivacyGuard never changes them behind your back."
        right={<Segmented value={tab} onChange={setTab} options={[{ value: "dns", label: "Block ads device-wide" }, { value: "ads", label: "Personalized ads" }, { value: "sharing", label: "Data sharing" }, { value: "ai", label: "AI tools" }]} />}
      />

      {tab === "dns" && (
        <div className="anim-fade">
          <Card className="p-4 mb-3" style={{ background: "var(--acc-dim)", borderColor: "color-mix(in srgb, var(--acc) 28%, transparent)" }}>
            <div className="flex gap-2.5">
              <Wifi size={16} className="flex-none mt-0.5" style={{ color: "var(--acc)" }} />
              <div>
                <div className="text-[12.5px] font-semibold" style={{ color: "var(--tx)" }}>Turn on ad blocking for every app on your phone</div>
                <p className="text-[11.5px] mut mt-1 leading-relaxed">
                  Android and iOS both support <b style={{ color: "var(--tx)" }}>encrypted DNS</b> system-wide. Point it at a
                  filtering resolver and ads/trackers are blocked in <i>all</i> apps — games, news apps, browsers — not just this one.
                  It is free, takes 30 seconds, uses no battery, and needs no VPN app.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <GuideCard icon={Smartphone} title="Android — Private DNS (Android 9+)" steps={[
              "Open Settings → Network & internet → Private DNS (on Samsung: Connections → More connection settings → Private DNS).",
              "Choose “Private DNS provider hostname”.",
              "Enter a filtering hostname from the list below, e.g. dns.adguard-dns.com",
              "Tap Save. Ads and trackers are now blocked in every app, over encrypted DNS-over-TLS.",
              "To undo at any time: set Private DNS back to “Automatic”.",
            ]} />
            <GuideCard icon={Smartphone} title="iPhone / iPad — Encrypted DNS profile" steps={[
              "Fastest route: install your provider's free DNS configuration profile (AdGuard, ControlD and Mullvad all publish one).",
              "Settings → General → VPN, DNS & Device Management → tap the downloaded profile → Install.",
              "Settings → General → VPN, DNS & Device Management → DNS → select the profile.",
              "Per-network alternative: Settings → Wi-Fi → (i) next to your network → Configure DNS → Manual → add the IPv4 address below.",
              "To undo: remove the profile, or set Configure DNS back to Automatic.",
            ]} />
          </div>

          <Card className="p-4">
            <div className="text-[10px] font-semibold tracking-[0.12em] uppercase dim mb-2.5">Filtering resolvers — tap to copy</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {DNS_PROVIDERS.map((p) => (
                <div key={p.name} className="rounded-xl px-3 py-2.5" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                  <div className="text-[12px] font-medium mb-1" style={{ color: "var(--tx)" }}>{p.name}</div>
                  <div className="flex gap-1.5 flex-wrap mb-1.5">
                    <button className="tag" style={{ cursor: "pointer" }} onClick={() => copy(p.host)}><Copy size={9} /> {p.host}</button>
                    <button className="tag" style={{ cursor: "pointer" }} onClick={() => copy(p.ipv4)}><Copy size={9} /> {p.ipv4}</button>
                  </div>
                  <div className="text-[10.5px] dim leading-snug">{p.note}</div>
                </div>
              ))}
            </div>
            <p className="text-[10.5px] dim mt-3 leading-relaxed">
              Honest caveat: DNS filtering blocks whole domains. Ads served from the <i>same</i> domain as the content
              (YouTube pre-rolls, Instagram in-feed ads, Twitch) cannot be separated this way by any DNS blocker — anyone
              claiming otherwise is overselling. Everything else — banner networks, trackers, telemetry — stops.
            </p>
          </Card>
        </div>
      )}

      {tab === "ads" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 anim-fade">
          <GuideCard icon={Shield} title="Android — kill the advertising ID" steps={[
            "Settings → Security & privacy → Privacy → Ads (older: Settings → Google → Ads).",
            "Tap “Delete advertising ID” and confirm — apps then receive a string of zeros instead of a trackable ID.",
            "Also enable “Opt out of Ads Personalization” if your version still shows it.",
            "Settings → Google → All services → Ads by Google → turn off Ad personalization.",
          ]} />
          <GuideCard icon={Shield} title="iPhone / iPad — App Tracking Transparency" steps={[
            "Settings → Privacy & Security → Tracking → turn OFF “Allow Apps to Request to Track”.",
            "This denies the IDFA to every app, retroactively.",
            "Settings → Privacy & Security → Apple Advertising → turn OFF Personalized Ads.",
            "Settings → Privacy & Security → Analytics & Improvements → turn off Share iPhone Analytics and Share with App Developers.",
          ]} />
          <GuideCard icon={Shield} title="Google account — stop ad profiling" steps={[
            "Visit myadcenter.google.com → turn off “Personalized ads”.",
            "myactivity.google.com → Web & App Activity → turn off, and delete existing activity.",
            "Same page: turn off YouTube History and Location History.",
            "Set auto-delete to 3 months for anything you keep.",
          ]} />
          <GuideCard icon={Shield} title="Meta / Microsoft / Amazon" steps={[
            "Facebook & Instagram: Settings → Accounts Center → Ad preferences → Ad settings → “Activity information from ad partners” → Not allowed.",
            "Microsoft: account.microsoft.com/privacy → Ad settings → off; also turn off Diagnostic data in Windows Settings → Privacy.",
            "Amazon: Account → Communication & content → Advertising preferences → “Do not show me interest-based ads”.",
            "TikTok/X/LinkedIn: Settings → Privacy → Ads → disable personalization and data sharing with partners.",
          ]} />
        </div>
      )}

      {tab === "sharing" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 anim-fade">
          <GuideCard icon={Smartphone} title="Android — stop OS data sharing" steps={[
            "Settings → Google → Usage & diagnostics → turn OFF.",
            "Settings → Security & privacy → Privacy → Activity controls → turn off Web & App Activity.",
            "Settings → Location → Location services → turn off Google Location Accuracy, Wi-Fi scanning and Bluetooth scanning.",
            "Settings → Apps → see all apps → per app → Permissions: revoke Camera, Microphone, Location, Contacts, Files from anything that doesn't need them.",
            "Settings → Security & privacy → Privacy → Permission manager → review Camera and Microphone lists specifically.",
          ]} />
          <GuideCard icon={Smartphone} title="iPhone — stop OS data sharing" steps={[
            "Settings → Privacy & Security → Analytics & Improvements → turn everything off.",
            "Settings → Privacy & Security → Location Services → set apps to “While Using” or Never; disable Precise Location where not needed.",
            "Location Services → System Services → turn off Product Improvement items (iPhone Analytics, Routing & Traffic, Significant Locations).",
            "Settings → Privacy & Security → Camera / Microphone → revoke apps you don't recognise.",
            "Enable Settings → Privacy & Security → App Privacy Report to see which apps contacted which domains — a native complement to this console.",
          ]} />
          <GuideCard icon={Shield} title="Browser hardening (both platforms)" steps={[
            "Use Firefox or Brave on Android; Safari with “Prevent Cross-Site Tracking” on iOS.",
            "Block third-party cookies entirely in browser settings.",
            "Install uBlock Origin (Firefox Android) for in-page ad blocking that DNS cannot do.",
            "Turn off “Send usage statistics / crash reports” in the browser's privacy settings.",
          ]} />
          <GuideCard icon={Shield} title="Network-level, everywhere" steps={[
            "Set the filtering DNS from the first tab — it covers every app, including ones with no privacy settings.",
            "On your home router, set the same DNS so all devices benefit (guests, TVs, IoT).",
            "Avoid “free VPN” apps: most monetise traffic logs — the opposite of what you want.",
            "Keep this console's Strict mode on for AI tools you don't actively trust.",
          ]} />
        </div>
      )}

      {tab === "ai" && (
        <div className="anim-fade">
          <Card className="p-4 mb-3" style={{ background: "var(--bad-dim)", borderColor: "color-mix(in srgb, var(--bad) 25%, transparent)" }}>
            <div className="flex gap-2.5">
              <BrainCircuit size={16} className="flex-none mt-0.5" style={{ color: "var(--bad)" }} />
              <div>
                <div className="text-[12.5px] font-semibold" style={{ color: "var(--tx)" }}>What actually leaves your device when you use cloud AI</div>
                <p className="text-[11.5px] mut mt-1 leading-relaxed">
                  Everything in the prompt: typed text, pasted code, attached documents, screenshots and images, and voice audio.
                  Blocking a cloud AI app's network access <b style={{ color: "var(--tx)" }}>stops the product from working</b> — that is expected, not a bug.
                  If you want AI that keeps data on-device, run a local model (Ollama / LM Studio) and keep it on localhost.
                </p>
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <GuideCard icon={Sparkles} title="ChatGPT / OpenAI" steps={[
              "Settings → Data controls → turn OFF “Improve the model for everyone”.",
              "Settings → Data controls → Chat history: disable if you want zero retention of new chats.",
              "Use Temporary Chat for anything sensitive.",
              "Never paste secrets, API keys or client data — deletion requests cannot un-train a model.",
            ]} />
            <GuideCard icon={Sparkles} title="Claude (Anthropic)" steps={[
              "Settings → Privacy → review the data-training preference and turn it off if offered on your plan.",
              "Delete conversations you no longer need; deletion removes them from your account view.",
              "For code work, prefer a project scope that excludes secrets and .env files.",
            ]} />
            <GuideCard icon={Sparkles} title="Gemini / Google AI" steps={[
              "myactivity.google.com/product/gemini → turn OFF Gemini Apps Activity.",
              "Note Google's own warning: conversations may be reviewed by humans when activity is on — turning it off stops future reviews.",
              "Delete past activity from the same page.",
            ]} />
            <GuideCard icon={Sparkles} title="Coding agents (Cursor, Copilot, Continue)" steps={[
              "Cursor: Settings → enable Privacy Mode so code is not retained server-side.",
              "GitHub Copilot: Settings → Copilot → disable “Allow GitHub to use my code snippets for product improvements”.",
              "Continue / local agents: point them at a localhost model to keep code on-device entirely.",
              "Add .env, credentials and key files to the agent's ignore list before indexing a repo.",
            ]} />
          </div>
        </div>
      )}
    </>
  );
}

function GuideCard({ icon: Icon, title, steps }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; title: string; steps: string[] }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  return (
    <Card hover className="p-4 anim-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color: "var(--acc)" }} />
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--tx)" }}>{title}</span>
        <span className="mono text-[10px] dim ml-auto">{done.size}/{steps.length}</span>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const isDone = done.has(i);
          return (
            <li key={i} className="flex items-start gap-2.5 cursor-pointer" onClick={() => setDone((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })}>
              <span className="w-4 h-4 rounded-[5px] grid place-items-center flex-none mt-0.5"
                style={{ background: isDone ? "var(--acc-dim)" : "var(--panel2)", border: `1px solid ${isDone ? "var(--acc)" : "var(--line2)"}` }}>
                {isDone && <Check size={10} style={{ color: "var(--acc)" }} />}
              </span>
              <span className="text-[11.5px] leading-relaxed" style={{ color: isDone ? "var(--dim)" : "var(--mut)", textDecoration: isDone ? "line-through" : undefined }}>{s}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
