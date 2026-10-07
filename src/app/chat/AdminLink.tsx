"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { apiUrl } from "@/lib/api-url";

// Shown only when the server grants the admin role (YunoHost `admin` permission).
export function AdminLink() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    fetch(apiUrl("/api/admin/me"), { cache: "no-store", redirect: "error" })
      .then((response) => setIsAdmin(response.ok))
      .catch(() => setIsAdmin(false));
  }, []);
  if (!isAdmin) return null;
  return (
    <Link href="/admin/framateam" className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200" title="Administration">
      <Settings className="h-3.5 w-3.5" />Admin
    </Link>
  );
}
