import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, session } from "../../api";
import { DemoStrip, Wordmark } from "../../components/ui";

const GROUPS = [
  { title: "Daily work", items: [
    { to: "/console", label: "Dashboard", end: true },
    { to: "/console/issues", label: "Problems" },
    { to: "/console/help", label: "Help requests" },
    { to: "/console/map", label: "Map" },
  ] },
  { title: "Records", items: [
    { to: "/console/facilities", label: "Toilets" },
    { to: "/console/reports", label: "Reports and audit" },
  ] },
  { title: "Setup", items: [
    { to: "/console/qr", label: "QR codes" },
    { to: "/console/signs", label: "Printable signs" },
  ] },
];

export default function ConsoleLayout() {
  const s = session()!;
  const nav = useNavigate();
  return (
    <div className="min-h-screen">
      <div className="md:flex">
        <aside className="border-b border-line bg-white print:hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
          <div className="flex items-center justify-between px-5 py-4 md:block">
            <Wordmark />
            <p className="mt-1 hidden text-[12px] text-ink-muted md:block">RMC operations · prototype</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Console">
            {GROUPS.map((g) => (
              <div key={g.title} className="contents md:block md:pb-3">
                <p className="hidden px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted md:block">{g.title}</p>
                {g.items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={"end" in n ? n.end : false}
                    className={({ isActive }) => `block whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-medium ${isActive ? "bg-river-light text-river" : "text-ink hover:bg-paper"}`}>
                    {n.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <NavLink to="/w" className="whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-medium text-ink hover:bg-paper">Field app</NavLink>
          </nav>
          <div className="hidden px-5 py-6 md:mt-auto md:block">
            <p className="text-[14px] font-semibold">{s.user.name}</p>
            <p className="text-[12px] capitalize text-ink-muted">{s.user.role}</p>
            <button className="mt-2 text-[13px] text-river hover:underline" onClick={() => { clearSession(); nav("/login"); }}>Sign out</button>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="print:hidden"><DemoStrip /></div>
          <main className="px-4 py-6 print:p-0 md:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
