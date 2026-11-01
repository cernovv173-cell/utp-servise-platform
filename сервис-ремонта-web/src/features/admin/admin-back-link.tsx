import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const AdminBackLink = () => (
  <Link
    to="/admin"
    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:border-[#405b9c]/40 dark:bg-[#0c142b] dark:text-slate-200 dark:hover:bg-[#17264b]"
  >
    <ArrowLeft size={16} aria-hidden="true" />К управлению
  </Link>
);
