import * as React from "react";
import { CheckCircle2, Clock3, RefreshCw, XCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type GrievanceStatus = "pending" | "in_progress" | "resolved" | "rejected" | "escalated" | string;

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: GrievanceStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export function StatusBadge({ status = "pending", size = "md", showIcon = true, className, ...props }: StatusBadgeProps) {
  const normalized = (status || "pending").toLowerCase().replaceAll(" ", "_");

  let colorClasses = "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700";
  let label = "Pending";
  let Icon = Clock3;
  let animateIcon = false;

  switch (normalized) {
    case "pending":
      label = "Pending";
      Icon = Clock3;
      colorClasses = "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700/60 shadow-xs";
      break;

    case "in_progress":
    case "in progress":
      label = "In Progress";
      Icon = RefreshCw;
      animateIcon = true;
      colorClasses = "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700/60 shadow-xs";
      break;

    case "resolved":
      label = "Resolved";
      Icon = CheckCircle2;
      colorClasses = "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/60 shadow-xs";
      break;

    case "rejected":
      label = "Rejected";
      Icon = XCircle;
      colorClasses = "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700/60 shadow-xs";
      break;

    case "escalated":
      label = "Escalated";
      Icon = ShieldAlert;
      colorClasses = "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-700/60 shadow-xs";
      break;

    default:
      label = normalized.replaceAll("_", " ").replace(/^./, (l) => l.toUpperCase());
      break;
  }

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1 font-semibold",
    md: "px-2.5 py-1 text-xs gap-1.5 font-bold",
    lg: "px-3 py-1.5 text-sm gap-2 font-bold",
  }[size];

  const iconSizes = {
    sm: "h-3 w-3 shrink-0",
    md: "h-3.5 w-3.5 shrink-0",
    lg: "h-4 w-4 shrink-0",
  }[size];

  return (
    <span
      key={normalized}
      className={cn(
        "inline-flex items-center rounded-full border transition-all duration-300 animate-in fade-in zoom-in-95 ease-out",
        colorClasses,
        sizeClasses,
        className
      )}
      {...props}
    >
      {showIcon && (
        <Icon className={cn(iconSizes, animateIcon ? "animate-spin text-blue-700 dark:text-blue-300" : "")} />
      )}
      <span>{label}</span>
    </span>
  );
}
