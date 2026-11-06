"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ATLAS_CONTROL_URL, HABBLAUD_ORIGIN_KEY, isWebsiteHealth, normalizeHabblaudOrigin, type WebsiteHealth } from "@/lib/learningControl";
import { getActiveLearnerProfileId, profileStorageKey, readProfileStorage, writeProfileStorage } from "@/lib/learnerProfiles";
import styles from "./LearningControlPanel.module.css";

export function LearningControlPanel({ farmOpen }: { farmOpen: boolean }) {
  const [health, setHealth] = useState<WebsiteHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [origin, setOrigin] = useState("");
  const [draft, setDraft] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [urlError, setUrlError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const loaded = useRef(false);

  useEffect(() => () => { request.current?.abort(); requestId.current += 1; }, []);

  function loadPrivateEntry() {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const stored = readProfileStorage(HABBLAUD_ORIGIN_KEY);
      if (stored) {
        const saved = normalizeHabblaudOrigin(stored);
        setOrigin(saved);
        setDraft(saved);
      }
    } catch {
      setConnectionMessage("Không đọc được địa chỉ đã lưu. Bạn vẫn có thể nhập lại bên dưới.");
    }
  }

  async function checkWebsite() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const id = ++requestId.current;
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setChecking(true);
    setHealthError("");
    try {
      const response = await fetch("/api/learning/control-health", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Website chưa trả lời kiểm tra thành công.");
      const data: unknown = await response.json();
      if (!isWebsiteHealth(data)) throw new Error("Phản hồi kiểm tra không đúng định dạng.");
      if (requestId.current === id) setHealth(data);
    } catch {
      if (requestId.current === id) setHealthError("Chưa nhận được phản hồi mới. Kiểm tra mạng rồi thử lại; kết quả cũ không chứng minh website vẫn online.");
    } finally {
      window.clearTimeout(timeout);
      if (requestId.current === id) setChecking(false);
    }
  }

  function savePrivateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = normalizeHabblaudOrigin(draft);
      setUrlError(false);
      setOrigin(saved);
      setDraft(saved);
      try {
        writeProfileStorage(HABBLAUD_ORIGIN_KEY, saved);
        setConnectionMessage("Đã lưu trên trình duyệt này. Chưa kiểm tra kết nối Habblaud.");
      } catch {
        setConnectionMessage("Có thể mở địa chỉ trong phiên này, nhưng trình duyệt không cho lưu để dùng lần sau.");
      }
    } catch (error) {
      setUrlError(true);
      setConnectionMessage(error instanceof Error ? error.message : "Địa chỉ chưa hợp lệ.");
    }
  }

  function removePrivateEntry() {
    try {
      localStorage.removeItem(profileStorageKey(HABBLAUD_ORIGIN_KEY));
      // readProfileStorage may have migrated a legacy unscoped value.
      if (getActiveLearnerProfileId() === "luan") localStorage.removeItem(HABBLAUD_ORIGIN_KEY);
      setOrigin("");
      setDraft("");
      setUrlError(false);
      setConnectionMessage("Đã bỏ địa chỉ khỏi trình duyệt này.");
    } catch {
      setConnectionMessage("Không xóa được địa chỉ đã lưu. Kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.");
    }
  }

  return (
    <details id="world-control" className={styles.panel} onToggle={(event) => { if (event.currentTarget.open) loadPrivateEntry(); }}>
      <summary className={styles.summary}>
        <span>Quản lý website & kết nối riêng</span>
        <small>Blog · Atlas · Habblaud</small>
      </summary>
      <div className={styles.content}>
        <p className={styles.intro}>Website và nông trại dùng được khi máy nhà tắt. Agent ở nhà chỉ chạy khi máy bật và đã kết nối riêng.</p>
        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="world-web-heading">
            <p className={styles.kicker}>WEBSITE</p>
            <h2 id="world-web-heading">Blog đang phản hồi thế nào?</h2>
            <div className={styles.status} role="status" aria-live="polite">
              {checking ? "Đang kiểm tra…" : healthError ? "Chưa xác minh được phản hồi mới" : health ? "API website đã phản hồi" : "Chưa kiểm tra"}
            </div>
            {health ? <p className={styles.note}>Lần kiểm tra thành công: <time dateTime={health.checkedAt}>{new Date(health.checkedAt).toLocaleString("vi-VN")}</time>.</p> : null}
            {healthError ? <p className={styles.error}>{healthError}</p> : null}
            <p className={styles.note}>Nông trại: {farmOpen ? "đang mở trên thiết bị này" : "chưa mở trên thiết bị này"}. Đây không phải trạng thái Claude hay Habblaud.</p>
            <button className="button button--primary" type="button" disabled={checking} onClick={() => void checkWebsite()}>Kiểm tra website</button>
            <p className={styles.note}>Chỉ kiểm tra endpoint của blog; chưa kiểm tra toàn bộ bài học, cơ sở dữ liệu hoặc máy nhà.</p>
          </section>
          <section className={styles.card} aria-labelledby="world-private-heading">
            <p className={styles.kicker}>MÁY NHÀ & AGENT</p>
            <h2 id="world-private-heading">Kết nối Habblaud riêng</h2>
            <p className={styles.status}>Trạng thái máy: xem sau đăng nhập Atlas</p>
            <p className={styles.note}>Atlas lưu tiến độ, lần nhận tín hiệu cuối và bằng chứng. Blog không nhận hội thoại hoặc thông tin đăng nhập Habblaud.</p>
            <a className="button button--ghost" href={ATLAS_CONTROL_URL} target="_blank" rel="noopener noreferrer">Mở Atlas online & máy nhà ↗</a>
            <p className={styles.note}>Trong Atlas chọn “Online & máy nhà”, đăng nhập ChatGPT. Máy chưa gửi heartbeat thì chưa thể biết đang làm hay đã tắt.</p>
          </section>
        </div>
        <form className={styles.connection} onSubmit={savePrivateEntry}>
          <label htmlFor="world-habblaud-origin">Địa chỉ Habblaud riêng của bạn</label>
          <p id="world-habblaud-hint" className={styles.note}>Dùng HTTPS đã cấu hình cho mạng riêng. localhost chỉ trỏ tới chính thiết bị đang mở trang, không trỏ tới máy nhà khi dùng điện thoại. Không nhập mật khẩu hoặc token vào địa chỉ.</p>
          <input id="world-habblaud-origin" type="url" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="https://máy-của-bạn:4748" autoComplete="off" maxLength={500} required aria-invalid={urlError} aria-describedby="world-habblaud-hint world-habblaud-message" />
          <div className={styles.actions}>
            <button className="button button--ghost" type="submit">Lưu địa chỉ trên thiết bị</button>
            {origin ? <a className="button button--primary" href={origin} target="_blank" rel="noopener noreferrer">Mở Habblaud riêng ↗</a> : null}
            {origin ? <button className="button button--ghost" type="button" onClick={removePrivateEntry}>Bỏ địa chỉ</button> : null}
          </div>
          <p id="world-habblaud-message" className={styles.note} role="status" aria-live="polite">{connectionMessage || "Chưa có kết nối được xác minh. Lưu địa chỉ chỉ tạo lối mở, không khởi chạy Habblaud hay cấp quyền điều khiển."}</p>
        </form>
      </div>
    </details>
  );
}
