"use client";

import { useState } from "react";
import { inputClass } from "@/components/Form";
import { deleteCar } from "@/lib/actions";

// Two-step delete: reveal a confirm input, and only enable the destructive button
// once the user types the car's exact name. Guards against an accidental tap
// wiping a car (now a soft-delete — the data is retained and stays in backups).
export function ConfirmDelete({ carId, carName }: { carId: number; carName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-red-400/80 active:text-red-400"
      >
        Delete this car
      </button>
    );
  }

  const confirmed = typed.trim() === carName.trim();

  return (
    <form action={deleteCar} className="space-y-3">
      <input type="hidden" name="id" value={carId} />
      <p className="text-sm text-zinc-400">
        This hides <span className="font-medium text-zinc-200">{carName}</span> and all
        its records. The data is kept and included in backups, but it disappears from the
        app. Type the car&apos;s name to confirm.
      </p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoFocus
        className={inputClass}
        placeholder={carName}
        aria-label="Type the car name to confirm deletion"
      />
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!confirmed}
          className="rounded-xl bg-red-500/90 px-4 py-2 text-sm font-medium text-white active:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete car
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-300 active:bg-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
