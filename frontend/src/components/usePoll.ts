import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

/** Fetch a URL now and every `ms`; keeps the last good data and reports staleness. */
export function usePoll<T>(url: string, ms = 15000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const alive = useRef(true);
  const reload = useCallback(async () => {
    try {
      const d = await api<T>(url);
      if (!alive.current) return;
      setData(d);
      setError(null);
      setUpdated(new Date());
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }, [url]);
  useEffect(() => {
    alive.current = true;
    reload();
    const id = setInterval(reload, ms);
    return () => { alive.current = false; clearInterval(id); };
  }, [reload, ms]);
  return { data, error, updated, reload };
}
