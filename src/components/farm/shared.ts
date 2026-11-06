import type * as Farm from "@/lib/farm/engine";

export type ActFn = (run: (game: Farm.GameState) => Farm.ActionResult) => void;
export type ShopTab = "seeds" | "trees" | "fish" | "animals" | "items" | "expand";
export type SheetName = "shop" | "barn" | "gifts" | "seeds" | "saplings" | "help" | "mill" | "workshops" | "truck" | "incubator";

export const STAGE_LABELS = ["Mới gieo", "Nảy mầm", "Đang lớn", "Đã chín"];
export const TREE_STAGE_LABELS = ["Cây giống", "Cây non", "Cây lớn"];
export const coinFormat = new Intl.NumberFormat("vi-VN");

export const SHEET_TITLES: Record<SheetName, string> = {
  shop: "🏪 Chợ làng",
  barn: "📦 Nhà kho",
  gifts: "🎁 Quà hằng ngày",
  seeds: "🌱 Chọn hạt giống",
  saplings: "🌳 Chọn cây giống",
  help: "❔ Cách chơi",
  mill: "🥣 Máng ăn & máy xay",
  workshops: "🏭 Xưởng chế biến",
  truck: "🚚 Xe tải lên phố",
  incubator: "🥚 Lò ấp trứng",
};
