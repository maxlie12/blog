// Plain module (no "use client") so the server layout's no-flash script can share the id list.
export const PALETTES = [
  { id: "forest", label: "Forest" },
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
  { id: "sakura", label: "Sakura" },
  { id: "ink", label: "Ink" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

export const DEFAULT_PALETTE: PaletteId = "forest";

export function isPaletteId(value: unknown): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}
