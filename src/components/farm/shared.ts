import type * as Farm from "@/lib/farm/engine";

export type ActFn = (run: (game: Farm.GameState) => Farm.ActionResult) => void;
export type ShopTab = "seeds" | "fish" | "animals" | "items" | "expand";
export type SheetName = "shop" | "barn" | "gifts" | "seeds" | "help" | "mill" | "workshops" | "truck";

export const STAGE_LABELS = ["Mới gieo", "Nảy mầm", "Đang lớn", "Đã chín"];
export const coinFormat = new Intl.NumberFormat("vi-VN");

export const SHEET_TITLES: Record<SheetName, string> = {
  shop: "🏪 Chợ làng",
  barn: "📦 Nhà kho",
  gifts: "🎁 Quà hằng ngày",
  seeds: "🌱 Chọn hạt giống",
  help: "❔ Cách chơi",
  mill: "🥣 Máng ăn & máy xay",
  workshops: "🏭 Xưởng chế biến",
  truck: "🚚 Xe tải lên phố",
};
