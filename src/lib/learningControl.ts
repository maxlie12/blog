export const ATLAS_CONTROL_URL = "https://atlas-gate-control.luanwqr.chatgpt.site/";
export const HABBLAUD_ORIGIN_KEY = "learning-habblaud-origin-v1";

export function normalizeHabblaudOrigin(value: string): string {
  const url = new URL(value.trim());
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("Dùng địa chỉ HTTPS gốc, không kèm mật khẩu, đường dẫn hay mã truy cập. HTTP chỉ dành cho localhost trên chính máy chạy Habblaud.");
  }
  return url.origin;
}

export type WebsiteHealth = { service: "maxlie-blog"; status: "responding"; checkedAt: string };

export function isWebsiteHealth(value: unknown): value is WebsiteHealth {
  if (!value || typeof value !== "object") return false;
  const health = value as Partial<WebsiteHealth>;
  return health.service === "maxlie-blog" && health.status === "responding" &&
    typeof health.checkedAt === "string" && Number.isFinite(Date.parse(health.checkedAt));
}
