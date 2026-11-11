// How each kind of inventory log entry is shown.
export const KIND_META = {
  created: { label: "New product", tone: "primary", icon: "plus" },
  restock: { label: "Stock in", tone: "success", icon: "arrowIn" },
  sale: { label: "Sold", tone: "info", icon: "receipt" },
  removed: { label: "Stock out", tone: "danger", icon: "arrowOut" },
  edited: { label: "Edited", tone: "warning", icon: "edit" },
  deleted: { label: "Deleted", tone: "danger", icon: "trash" },
};

export const kindMeta = (entry) => KIND_META[entry.kind] || (entry.action === "in" ? KIND_META.restock : KIND_META.removed);

// Signed quantity text for stock-changing entries, "" for edits/deletions.
export function qtyText(entry) {
  if (entry.action === "in") return `+${entry.quantity}`;
  if (entry.action === "out") return `−${entry.quantity}`;
  return "";
}

export const FIELD_LABELS = {
  name: "Name",
  sku: "SKU",
  category: "Category",
  warehouse: "Warehouse",
  price: "Price",
  minThreshold: "Alert level",
  vendor: "Vendor",
  notes: "Notes",
};

// One-line description of an entry (used in lists)
export function describe(entry) {
  if (entry.kind === "edited") {
    const fields = (entry.changes || []).map((c) => FIELD_LABELS[c.field] || c.field);
    return fields.length ? `Changed ${fields.join(", ").toLowerCase()}` : "Details updated";
  }
  if (entry.kind === "deleted") return "Removed from catalogue";
  return entry.notes || kindMeta(entry).label;
}
