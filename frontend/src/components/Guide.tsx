import { useState } from "react";
import { Icon } from "./icons";

/** First-time guide: three picture cards, shown once per phone. */
export default function Guide({ storageKey, slides, labels }: {
  storageKey: string;
  slides: { icon: string; title: string; text: string }[];
  labels: { next: string; start: string; skip: string };
}) {
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== "1");
  const [i, setI] = useState(0);
  if (!open) return null;
  const close = () => { localStorage.setItem(storageKey, "1"); setOpen(false); };
  const s = slides[i];
  const last = i === slides.length - 1;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-3 sm:items-center" role="dialog" aria-modal="true" data-testid="guide">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
        <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-river-light text-river">
          <Icon name={s.icon} className="h-14 w-14" strokeWidth={2.2} />
        </span>
        <p className="mt-5 text-[22px] font-bold leading-snug">{s.title}</p>
        <p className="mt-2 text-[16px] text-ink-muted">{s.text}</p>
        <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
          {slides.map((_, k) => <span key={k} className={`h-2.5 rounded-full ${k === i ? "w-7 bg-river" : "w-2.5 bg-line"}`} />)}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <button className="btn-quiet" onClick={close} data-testid="guide-skip">{labels.skip}</button>
          <button className="btn-primary col-span-2 py-3.5 text-[17px]" onClick={() => (last ? close() : setI(i + 1))} data-testid="guide-next">
            {last ? labels.start : labels.next}
          </button>
        </div>
      </div>
    </div>
  );
}
