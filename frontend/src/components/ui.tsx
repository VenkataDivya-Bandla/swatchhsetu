import type { ReactNode } from "react";
import type { Status } from "../api";
import { formatMinutes } from "../api";
import { STATUS } from "../status";

export function DemoStrip({ text = "Demo — synthetic data. Not a live RMC system." }: { text?: string }) {
  return <div className="bg-marigold-light px-4 py-1.5 text-center text-[13px] font-medium text-marigold-deep">{text}</div>;
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${light ? "text-white" : "text-river"}`}>
      <img src="/icon.svg" alt="" className="h-7 w-7" />
      <span className="text-[17px]">SwachhSetu</span>
    </span>
  );
}

export function StatusPill({ status, small = false }: { status: Status; small?: boolean }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 ${small ? "py-0.5 text-[12px]" : "py-1 text-[13px]"} font-semibold ${s.text}`}
      style={{ borderColor: s.hex + "55", background: s.hex + "12", borderStyle: status === "overdue" ? "dashed" : "solid" }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: s.hex }} />
      {s.label}
    </span>
  );
}

/** Minutes since last verification, shown with the window so staleness is visible at a glance. */
export function Freshness({ age, windowMin }: { age: number | null; windowMin: number }) {
  if (age === null) return <span className="font-semibold text-st-overdue">never checked</span>;
  const late = age > windowMin;
  return (
    <span className={late ? "font-semibold text-st-overdue" : "text-ink"}>
      {formatMinutes(age)} ago{late && <span className="text-ink-muted font-normal"> · window {formatMinutes(windowMin)}</span>}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-[14px] text-ink-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg border border-st-issue/30 bg-orange-50 px-3 py-2 text-[14px] text-st-issue">{message}</p>;
}

export const PRIORITY_STYLE: Record<string, string> = {
  P1: "bg-st-issue text-white",
  P2: "bg-marigold-light text-marigold-deep",
  P3: "bg-paper text-ink-muted border border-line",
};

export function Priority({ p }: { p: string }) {
  return <span className={`rounded-md px-1.5 py-0.5 text-[12px] font-bold ${PRIORITY_STYLE[p]}`}>{p}</span>;
}
