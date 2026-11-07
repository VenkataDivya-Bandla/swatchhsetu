/** Simple stroke pictograms, used instead of words wherever possible. 24×24 grid. */
const P: Record<string, string> = {
  tick: "M5 12.5l4.5 4.5L19 7.5",
  cross: "M6 6l12 12M18 6L6 18",
  alert: "M12 3l9.5 17h-19zM12 10v4.5M12 17.5h.01",
  wrench: "M14.5 5.5a4 4 0 0 0 5 5L12 18a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  drop: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z",
  dropOff: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11zM4 4l16 16",
  women: "M12 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 9l-3.5 7h7zM10.5 16v4.5M13.5 16v4.5",
  men: "M12 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9.5 9h5v6h-5zM10.5 15v5.5M13.5 15v5.5",
  wheelchair: "M11 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 8v6h5l2 5M8 11.5a5 5 0 1 0 7 6",
  free: "M7 5h10M7 9h10M7 5c5 0 5 8 0 8l7 7",
  speaker: "M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  arrow: "M12 20V4M5 11l7-7 7 7",
  broom: "M15 3l-4 9M7 12h8l2 9H5zM9 16v5M13 16v5",
  toilet: "M6 4h5v6H6zM4 10h14a6 6 0 0 1-6 6h-1l1 4H8l1-4a5 5 0 0 1-5-6z",
  blocked: "M5 4h14v4H5zM8 8v5a4 4 0 0 0 8 0V8M4 20h16M9 17l-2 3M15 17l2 3",
  door: "M6 3h11v18H6zM14 12h.01M3 21h18",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z",
  hand: "M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4a1.5 1.5 0 0 1 2.3-2L8 14",
  smell: "M6 19c2-3-2-5 0-8s-1-5 1-7M12 19c2-3-2-5 0-8s-1-5 1-7M18 19c2-3-2-5 0-8s-1-5 1-7",
  unsafe: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 9v4M12 16h.01",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  truck: "M2 7h11v9H2zM13 10h4l3 3v3h-7zM6 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  crowd: "M8 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM16 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 20v-4a4 4 0 0 1 8 0v4M12 20v-4a4 4 0 0 1 8 0v4",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  share: "M12 3v12M7 8l5-5 5 5M5 13v7h14v-7",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  scan: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  comment: "M4 5h16v11H9l-5 4z",
  back: "M15 5l-7 7 7 7",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8",
  stop: "M7 7h10v10H7z",
  person: "M12 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM7 21v-5a5 5 0 0 1 10 0v5",
  payX: "M3 7h18v11H3zM3 11h18M4 4l16 17",
  attendant: "M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21v-4a6 6 0 0 1 12 0v4M9 14l3 3 3-3",
};

export function Icon({ name, className = "h-6 w-6", strokeWidth = 2, style }: { name: string; className?: string; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] || P.dots} />
    </svg>
  );
}
