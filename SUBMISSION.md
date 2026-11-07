# Providing the prototype in the RTIH submission

RTIH asks for a "Prototype / PoC / MVP demonstration link, where available". Give evaluators three things: a link they can open, proof that the flows work, and a short video in case the link is slow.

## 1. What to put in the form

| Field | What to enter |
| --- | --- |
| Demo link | `https://<service-name>.onrender.com` (from the Render deployment in README) |
| Demo credentials | Supervisor `ravi` / PIN `1234` · Workers `eswar`, `durga` / PIN `1234` |
| Source code | `https://github.com/<you>/swachhsetu-prototype` (public, or shared with the evaluators) |
| Video | `walkthrough.mp4` uploaded to YouTube (unlisted) or Google Drive (anyone with the link) |
| Evidence | `demo-report.md` (29/29 checks) and the `screens/` folder, zipped, or linked from the repo |

Also paste the demo link and credentials into the concept note's section 5 ("Prototype and demonstration") and the deck's demo slide.

## 2. Steps, in order

1. Push the code to GitHub (README → *Put the code on GitHub*).
2. Deploy to Render (README → *Deploy a permanent demo link*) and check that `/api/health` returns 10 facilities.
3. In a Codespace, run the evidence against the deployed link:
   ```bash
   BASE=https://<service-name>.onrender.com make evidence
   make video
   ```
4. Commit the report so evaluators can see it in the repo:
   ```bash
   git add -f captures/demo-report.md && git commit -m "Demo evidence" && git push
   ```
5. Upload `captures/walkthrough.mp4` (unlisted YouTube or Drive) and copy the link.
6. Test the demo link from a phone on mobile data, signed out, before submitting.

## 3. Suggested text for the form

> SwachhSetu working prototype (synthetic data): <demo link>. Sign in as `ravi` / `1234` for the supervisor console, or `eswar` / `1234` for the worker field app. Open any public QR page from the home screen without signing in. A 29-step automated end-to-end check passes (report: <link>). Video walkthrough: <link>. Source: <repo link>.

## 4. On the day of the jury

- Open the demo link 10 minutes early, because free hosting sleeps when idle.
- Sign in as `ravi`, go to **Reports and audit**, and press **Reset demo data**.
- Print the **QR codes** sheet, or show it on a second screen, so jurors can scan DC-T01 with their own phones.
- Keep `walkthrough.mp4` on your laptop in case the venue network fails.
