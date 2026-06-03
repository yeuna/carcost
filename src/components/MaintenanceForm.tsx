"use client";

import { useState } from "react";
import { inputClass, labelClass, Field, SubmitButton } from "@/components/Form";
import { money } from "@/lib/utils";

type ItemRow = { key: number; name: string; qty: string; cost: string };

type MaintenanceEntry = {
  id: number;
  type: string;
  title: string;
  date: string;
  odometer: number;
  shop: string | null;
  laborCost: string | null;
  notes: string | null;
  scheduleId: number | null;
  items: Array<{ id: number; name: string; cost: string; quantity: number }>;
};

export function MaintenanceForm({
  carId,
  today = "",
  schedules,
  action,
  entry,
}: {
  carId: number;
  today?: string;
  schedules: { id: number; name: string }[];
  action: (form: FormData) => void;
  entry?: MaintenanceEntry;
}) {
  const [type, setType] = useState<"diy" | "dealer">(
    entry?.type === "dealer" ? "dealer" : "diy",
  );
  const [items, setItems] = useState<ItemRow[]>(
    entry?.items.length
      ? entry.items.map((it) => ({
          key: it.id,
          name: it.name,
          qty: String(it.quantity),
          cost: String(it.cost),
        }))
      : [{ key: 1, name: "", qty: "1", cost: "" }],
  );
  const [labor, setLabor] = useState(
    entry?.type === "diy" ? String(entry.laborCost ?? "") : "",
  );
  const [dealerCost, setDealerCost] = useState(
    entry?.type === "dealer" ? String(entry.laborCost ?? "") : "",
  );

  function updateItem(key: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { key: Date.now(), name: "", qty: "1", cost: "" }]);
  }
  function removeItem(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }

  const partsTotal = items.reduce((a, it) => {
    const c = parseFloat(it.cost) || 0;
    const q = parseInt(it.qty) || 1;
    return a + c * q;
  }, 0);
  const total =
    type === "diy" ? partsTotal + (parseFloat(labor) || 0) : parseFloat(dealerCost) || 0;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="carId" value={carId} />
      <input type="hidden" name="type" value={type} />
      {entry && <input type="hidden" name="entryId" value={entry.id} />}

      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-900 p-1 ring-1 ring-white/10">
        {(["diy", "dealer"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`rounded-lg py-2 text-sm font-medium ${
              type === t ? "bg-blue-600" : "text-zinc-400"
            }`}
          >
            {t === "diy" ? "🔧 DIY" : "🏢 Dealer / Shop"}
          </button>
        ))}
      </div>

      <Field label="What was done">
        <input
          name="title"
          required
          defaultValue={entry?.title ?? ""}
          className={inputClass}
          placeholder={type === "diy" ? "Oil change" : "30k service"}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input
            type="date"
            name="date"
            defaultValue={entry?.date ?? today}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Odometer">
          <input
            name="odometer"
            inputMode="numeric"
            required
            defaultValue={entry ? String(entry.odometer) : ""}
            className={inputClass}
            placeholder="miles"
          />
        </Field>
      </div>

      {type === "diy" ? (
        <div>
          <label className={labelClass}>Parts / items purchased</label>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.key} className="flex gap-2">
                <input
                  name="itemName"
                  value={it.name}
                  onChange={(e) => updateItem(it.key, { name: e.target.value })}
                  className={inputClass + " flex-1"}
                  placeholder="Oil filter"
                />
                <input
                  name="itemQty"
                  value={it.qty}
                  onChange={(e) => updateItem(it.key, { qty: e.target.value })}
                  inputMode="numeric"
                  className={inputClass + " w-14 text-center"}
                  aria-label="Quantity"
                />
                <input
                  name="itemCost"
                  value={it.cost}
                  onChange={(e) => updateItem(it.key, { cost: e.target.value })}
                  inputMode="decimal"
                  className={inputClass + " w-24"}
                  placeholder="$ ea"
                />
                <button
                  type="button"
                  onClick={() => removeItem(it.key)}
                  className="px-2 text-zinc-500 active:text-red-400"
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-2 text-sm text-blue-400 active:text-blue-300"
          >
            + Add another item
          </button>

          <div className="mt-4">
            <Field label="Labor / other cost (optional)">
              <input
                name="laborCost"
                value={labor}
                onChange={(e) => setLabor(e.target.value)}
                inputMode="decimal"
                className={inputClass}
                placeholder="$0.00"
              />
            </Field>
          </div>
        </div>
      ) : (
        <>
          <Field label="Shop">
            <input
              name="shop"
              defaultValue={entry?.shop ?? ""}
              className={inputClass}
              placeholder="Honda of Anytown"
            />
          </Field>
          <Field label="Total cost">
            <input
              name="laborCost"
              value={dealerCost}
              onChange={(e) => setDealerCost(e.target.value)}
              inputMode="decimal"
              required
              className={inputClass}
              placeholder="$0.00"
            />
          </Field>
        </>
      )}

      {schedules.length > 0 && (
        <Field label="Counts as service (optional)" hint="Resets that service's mileage reminder.">
          <select
            name="scheduleId"
            className={inputClass}
            defaultValue={entry?.scheduleId != null ? String(entry.scheduleId) : ""}
          >
            <option value="">— None —</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Notes (optional)">
        <textarea
          name="notes"
          rows={2}
          defaultValue={entry?.notes ?? ""}
          className={inputClass}
          placeholder="Anything worth remembering"
        />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
        <span className="text-sm text-zinc-400">Total</span>
        <span className="text-lg font-semibold">{money(total)}</span>
      </div>

      <SubmitButton>{entry ? "Save changes" : "Save entry"}</SubmitButton>
    </form>
  );
}
