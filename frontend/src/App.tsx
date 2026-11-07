import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { session, type Role } from "./api";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import PublicPage from "./pages/PublicPage";
import ConsoleLayout from "./pages/console/Layout";
import Dashboard from "./pages/console/Dashboard";
import MapView from "./pages/console/MapView";
import Issues from "./pages/console/Issues";
import HelpRequests from "./pages/console/HelpRequests";
import Facilities from "./pages/console/Facilities";
import Reports from "./pages/console/Reports";
import QrSheet from "./pages/console/QrSheet";
import Signs from "./pages/console/Signs";
import WorkerApp from "./pages/worker/WorkerApp";

function Guard({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const s = session();
  const loc = useLocation();
  if (!s) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!roles.includes(s.user.role)) return <Navigate to={s.user.role === "worker" ? "/w" : "/console"} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/f/:token" element={<PublicPage />} />
      <Route path="/console" element={<Guard roles={["admin", "supervisor"]}><ConsoleLayout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="map" element={<MapView />} />
        <Route path="issues" element={<Issues />} />
        <Route path="help" element={<HelpRequests />} />
        <Route path="facilities" element={<Facilities />} />
        <Route path="reports" element={<Reports />} />
        <Route path="qr" element={<QrSheet />} />
        <Route path="signs" element={<Signs />} />
      </Route>
      <Route path="/w/*" element={<Guard roles={["worker", "supervisor", "admin"]}><WorkerApp /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
