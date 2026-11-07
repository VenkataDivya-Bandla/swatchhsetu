// Drives the full SwachhSetu demo in a real browser and saves evidence:
//   captures/screens/NN-*.png  (desktop and phone screenshots)
//   captures/video/*.webm      (screen recordings of each phone)
// Usage: BASE=http://localhost:8000 node capture.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE || "http://localhost:8000").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT || "../../captures");
const SHOTS = path.join(OUT, "screens");
const VIDEO = path.join(OUT, "video");
mkdirSync(SHOTS, { recursive: true });
mkdirSync(VIDEO, { recursive: true });
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
let n = 0;
// Most contexts skip the first-time guides; one context below captures them on purpose.
const SKIP_GUIDES = () => { localStorage.setItem("ss_guide_pub", "1"); localStorage.setItem("ss_guide_worker", "1"); };
async function ctx(opts = {}, guides = false) {
  const c = await browser.newContext(opts);
  if (!guides) await c.addInitScript(SKIP_GUIDES);
  return c;
}
const shot = async (page, name, full = false) => {
  n += 1;
  const file = path.join(SHOTS, `${String(n).padStart(2, "0")}-${name}.png`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: file, fullPage: full });
  console.log("saved", path.basename(file));
};

async function apiLogin(username) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, pin: "1234" }) });
  return (await r.json()).token;
}
async function apiGet(p, token) {
  const r = await fetch(BASE + p, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}
async function uiLogin(page, username) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

// Fake camera and microphone so the voice complaint can be recorded in a headless browser
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
try {
  // Fresh demo data
  const ravi = await apiLogin("ravi");
  await fetch(`${BASE}/api/demo/reset`, { method: "POST", headers: { Authorization: `Bearer ${ravi}` } });
  const facs = Object.fromEntries((await apiGet("/api/facilities", ravi)).map((f) => [f.code, f]));
  const dc1 = facs["DC-T01"];

  // 1. Supervisor console: starting picture
  const desk = await ctx({ viewport: { width: 1440, height: 900 } });
  const sup = await desk.newPage();
  await uiLogin(sup, "ravi");
  await sup.getByText("Attention now").waitFor();
  await shot(sup, "dashboard-start");
  await sup.goto(`${BASE}/console/map`);
  await shot(sup, "map");
  await sup.goto(`${BASE}/console/facilities?id=${facs["DS-T01"].id}`);
  await sup.getByText("Issues ·").waitFor();
  await shot(sup, "facility-history-repeat-complaints", true);

  // 2. A pilgrim's family reports a blocked toilet: icon-first status, one tap, no app, no login
  // First visit: the three-card picture guide
  const first = await ctx(PHONE, true);
  const fp = await first.newPage();
  await fp.goto(`${BASE}/f/${dc1.public_token}`);
  await fp.getByTestId("guide").waitFor();
  await shot(fp, "public-first-time-guide");
  await first.close();

  const juror = await ctx({ ...PHONE, locale: "te-IN", recordVideo: { dir: VIDEO, size: { width: 390, height: 844 } } });
  const pub = await juror.newPage();
  await pub.goto(`${BASE}/f/${dc1.public_token}`);
  await pub.getByTestId("status").waitFor();
  await shot(pub, "public-icon-status-telugu");
  await pub.getByTestId("report-tile-blocked").scrollIntoViewIfNeeded();
  await shot(pub, "public-picture-tiles");
  await pub.getByTestId("report-tile-blocked").click();
  await pub.getByTestId("report-sent").waitFor();
  await shot(pub, "public-report-sent", true);

  // Safety: "feels unsafe" shows helpline numbers at once (Hindi, to show the third language)
  const safety = await ctx({ ...PHONE, locale: "hi-IN" });
  const sp = await safety.newPage();
  await sp.goto(`${BASE}/f/${facs["DS-T03"].public_token}`);
  await sp.getByRole("button", { name: "हिन्दी" }).click();
  await sp.getByTestId("report-tile-unsafe").click();
  await sp.getByTestId("helplines").waitFor();
  await shot(sp, "public-unsafe-helplines-hindi");
  await safety.close();

  // Voice complaint: someone who cannot read speaks instead (fake microphone in this run)
  const vctx = await ctx({ ...PHONE, permissions: ["microphone"] });
  const vp = await vctx.newPage();
  await vp.goto(`${BASE}/f/${facs["DC-T02"].public_token}`);
  await vp.getByTestId("voice").scrollIntoViewIfNeeded();
  const vb = await vp.getByTestId("voice").boundingBox();
  await vp.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  await vp.mouse.down(); // hold to talk
  await vp.waitForTimeout(2500);
  await shot(vp, "public-voice-hold-to-talk");
  await vp.mouse.up(); // let go to send
  await vp.getByTestId("report-sent").waitFor();
  await shot(vp, "public-voice-complaint-sent");
  await vctx.close();

  // Undo: a report sent by mistake (wrong picture) is cancelled within 5 seconds
  const uctx = await ctx(PHONE);
  const up = await uctx.newPage();
  await up.goto(`${BASE}/f/${facs["DS-T03"].public_token}`);
  await up.getByTestId("report-tile-light").click();
  await up.getByTestId("undo").click();
  await up.getByTestId("status").waitFor();
  await shot(up, "public-undo-wrong-picture");
  await uctx.close();

  // 3. A second person reports the same problem: it merges
  await fetch(`${BASE}/api/public/f/${dc1.public_token}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "blocked", lang: "en", device_key: "capture-second-juror" }) });
  await pub.goto(`${BASE}/f/${dc1.public_token}`);
  await pub.getByTestId("nearby").first().waitFor();
  await shot(pub, "public-problem-with-nearby-toilets", true);

  // 4. Supervisor assigns
  const issues = await apiGet("/api/issues", ravi);
  const issue = issues.find((i) => i.facility.code === "DC-T01" && i.category === "blocked");
  await sup.goto(`${BASE}/console/issues?id=${issue.id}`);
  await sup.getByText("Public reports").waitFor();
  await shot(sup, "issue-two-reports-merged");
  const eswarId = (await apiGet("/api/users?role=worker", ravi)).find((u) => u.username === "eswar").id;
  await sup.getByLabel("Worker").selectOption(String(eswarId));
  await sup.getByRole("button", { name: "Assign" }).click();
  await sup.getByText("Assigned.").waitFor();
  await shot(sup, "issue-assigned");

  // 5. Worker (Telugu-first app) fixes it with no network, then reconnects
  const wctx = await ctx({ ...PHONE, recordVideo: { dir: VIDEO, size: { width: 390, height: 844 } } });
  const w = await wctx.newPage();
  await uiLogin(w, "eswar");
  await w.getByTestId("worker-scan").waitFor();
  await w.waitForTimeout(1200);
  await shot(w, "worker-tasks-scan-button");
  await w.goto(`${BASE}/w/s/${dc1.staff_token}`);
  await w.getByTestId("mark-fixed").waitFor();
  await shot(w, "worker-facility-actions");
  await wctx.setOffline(true);
  await w.evaluate(() => window.dispatchEvent(new Event("offline")));
  await w.getByTestId("fix-note").fill("Cleared blockage, flushed lines");
  await w.getByTestId("mark-fixed").click();
  await w.getByTestId("worker-msg").waitFor();
  await shot(w, "worker-fix-saved-offline");
  await w.getByTestId("outbox-tab").click();
  await shot(w, "worker-outbox-offline");
  await sup.goto(`${BASE}/console/issues?id=${issue.id}`);
  await sup.getByText("Public reports").waitFor();
  await shot(sup, "console-before-sync-still-assigned");
  await wctx.setOffline(false);
  await w.evaluate(() => window.dispatchEvent(new Event("online")));
  await w.getByTestId("outbox-empty").waitFor({ timeout: 20000 });
  await shot(w, "worker-synced");

  // 6. The fixer tries to verify their own fix: blocked
  await w.goto(`${BASE}/w/s/${dc1.staff_token}`);
  await w.getByTestId("confirm-fix").click();
  await w.getByTestId("worker-error").waitFor();
  await shot(w, "worker-self-verification-blocked");

  // 6b. Worker asks for help they cannot give themselves
  await w.getByTestId("need-help").click();
  await shot(w, "worker-need-help");
  await w.getByTestId("help-plumber").click();
  await w.getByTestId("worker-msg").waitFor();

  // 7. A second worker confirms on site
  const dctx = await ctx({ ...PHONE, recordVideo: { dir: VIDEO, size: { width: 390, height: 844 } } });
  const d = await dctx.newPage();
  await uiLogin(d, "durga");
  await d.goto(`${BASE}/w/s/${dc1.staff_token}`);
  await d.getByTestId("confirm-fix").click();
  await d.getByTestId("worker-msg").waitFor();
  await shot(d, "second-worker-confirms");

  // 8. Public page now shows a fresh verification and asks "Is this fixed?"
  await pub.goto(`${BASE}/f/${dc1.public_token}`);
  await pub.getByTestId("fixed-question").waitFor();
  await shot(pub, "public-verified-and-closure-check");

  // 9. Overdue facility: checklist with pictures, then one-tap "Everything is OK" offline
  const actx = await ctx(PHONE, true);
  const a = await actx.newPage();
  await uiLogin(a, "anil");
  await a.getByTestId("guide").waitFor();
  await shot(a, "worker-first-time-guide");
  await a.getByTestId("guide-skip").click();
  await a.goto(`${BASE}/w/s/${facs["DN-T04"].staff_token}`);
  await a.getByTestId("something-wrong").click();
  await shot(a, "worker-picture-checklist");
  await a.getByRole("button", { name: /రద్దు|Cancel/ }).last().click();
  await actx.setOffline(true);
  await a.evaluate(() => window.dispatchEvent(new Event("offline")));
  await a.getByTestId("all-ok").click(); // first tap asks to confirm
  await shot(a, "worker-everything-ok-confirm");
  await a.getByTestId("all-ok").click();
  await a.getByTestId("worker-msg").waitFor();
  await a.getByTestId("queue-long").click();
  await a.waitForTimeout(500);
  await shot(a, "worker-everything-ok-and-queue-offline", true);
  await actx.setOffline(false);
  await a.evaluate(() => window.dispatchEvent(new Event("online")));
  await a.waitForTimeout(2500);

  // 10. Console: voice playback, help requests, dashboard, reports, audit chain, QR sheet, signs
  const voiceIssue = (await apiGet("/api/issues", ravi)).find((i) => i.facility.code === "DC-T02" && i.category === "other");
  await sup.goto(`${BASE}/console/issues?id=${voiceIssue.id}`);
  await sup.getByTestId("play-voice").click();
  await sup.getByTestId("voice-player").waitFor();
  await shot(sup, "issue-voice-complaint-playback");
  await sup.goto(`${BASE}/console/help`);
  await sup.getByTestId("help-card").first().waitFor();
  await shot(sup, "help-requests");
  await sup.goto(`${BASE}/console`);
  await sup.getByText("Attention now").waitFor();
  await shot(sup, "dashboard-after");
  await sup.goto(`${BASE}/console/reports`);
  await sup.getByRole("button", { name: "Check audit chain" }).click();
  await sup.getByText("Intact").waitFor();
  await shot(sup, "reports-and-audit-chain", true);
  await sup.goto(`${BASE}/console/qr`);
  await shot(sup, "qr-sheet");
  await sup.goto(`${BASE}/console/signs`);
  await sup.getByTestId("sign").first().waitFor();
  await sup.waitForTimeout(800);
  await sup.getByTestId("sign").first().screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, "0")}-printable-sign.png`) });
  console.log("saved printable-sign");
  await sup.pdf?.({ path: path.join(OUT, "signs.pdf"), format: "A4", printBackground: true }).catch(() => {});

  for (const c of [juror, wctx, dctx, actx, desk]) await c.close();
  // Give the recordings readable names
  for (const [page, name] of [[pub, "phone-1-pilgrim"], [w, "phone-2-worker-eswar"], [d, "phone-3-worker-durga"]]) {
    const v = page.video();
    if (v) { await v.saveAs(path.join(VIDEO, `${name}.webm`)); await v.delete(); }
  }
  console.log(`\nDone. Screenshots in ${SHOTS}, recordings in ${VIDEO}`);
} finally {
  await browser.close();
}
