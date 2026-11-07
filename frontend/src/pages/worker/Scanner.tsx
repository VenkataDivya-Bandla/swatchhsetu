import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/icons";

/** In-app QR scanner. Returns the 6-character staff code from a staff QR (URL …/w/s/CODE) or a bare code. */
export function extractStaffCode(text: string): string | null {
  const m = text.match(/\/w\/s\/([A-Z0-9]{6})/i) || text.trim().match(/^([A-Z0-9]{6})$/i);
  return m ? m[1].toUpperCase() : null;
}

export default function Scanner({ title, hint, cancel, failText, onCode, onClose }: {
  title: string; hint: string; cancel: string; failText: string; onCode: (code: string) => void; onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2 && ctx) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (hit) {
          const code = extractStaffCode(hit.data);
          if (code) {
            navigator.vibrate?.(80);
            stopped = true;
            onCode(code);
            return;
          }
          setWrong(true); // a QR, but not a staff code (for example the public sign)
        }
      }
      raf = requestAnimationFrame(tick);
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setFailed(true));
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-ink text-white" role="dialog" aria-label={title}>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-[17px] font-bold">{title}</p>
        <button className="rounded-lg bg-white/15 px-3 py-2 font-semibold" onClick={onClose}>{cancel}</button>
      </div>
      {failed ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Icon name="camera" className="h-14 w-14 text-white/70" />
          <p className="text-[16px]">{failText}</p>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <video ref={video} className="h-full w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-64 w-64 rounded-3xl border-4 border-marigold shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
          <p className="absolute bottom-6 left-0 right-0 px-6 text-center text-[16px] font-semibold">
            {wrong ? "⚠ " : ""}{hint}
          </p>
        </div>
      )}
    </div>
  );
}
