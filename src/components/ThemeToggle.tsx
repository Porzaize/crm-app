"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function getTheme(): Theme {
  return (document.documentElement.getAttribute("data-theme") as Theme) === "dark" ? "dark" : "light";
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("crm-theme", t);
  } catch {
    /* localStorage อาจถูกปิด — ไม่เป็นไร */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === "crm-theme") cb(); // sync เมื่อสลับโหมดในอีกแท็บ
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * ปุ่มสลับโหมดสว่าง/มืด — แหล่งความจริงคือ attribute data-theme บน <html>
 * + localStorage ("crm-theme"). ค่าเริ่มต้น/กันจอกระพริบจัดการโดย inline script
 * ใน root layout. ใช้ useSyncExternalStore เพื่ออ่านสถานะภายนอกอย่างปลอดภัย
 * (ฝั่ง server snapshot = "light" → ไม่ขึ้น hydration error).
 */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);

  return (
    <button
      type="button"
      onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
      className="theme-toggle"
      aria-label="สลับโทนสว่าง/มืด"
    >
      {theme === "dark" ? "☀️ โหมดสว่าง" : "🌙 โหมดมืด"}
    </button>
  );
}
