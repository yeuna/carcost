import { ReminderStatus } from "@/lib/utils";

const styles: Record<ReminderStatus, string> = {
  overdue: "bg-red-500/15 text-red-400 ring-red-500/30",
  soon: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  ok: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  unknown: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
};

const labels: Record<ReminderStatus, string> = {
  overdue: "Overdue",
  soon: "Due soon",
  ok: "OK",
  unknown: "No data",
};

export function StatusBadge({
  status,
  children,
}: {
  status: ReminderStatus;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {children ?? labels[status]}
    </span>
  );
}
