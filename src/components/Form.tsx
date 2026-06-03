export const inputClass =
  "w-full rounded-xl bg-zinc-800 px-4 py-3 text-base outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-500";

export const labelClass = "mb-1.5 block text-sm font-medium text-zinc-300";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium active:bg-blue-700"
    >
      {children}
    </button>
  );
}
