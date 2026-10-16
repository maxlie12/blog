"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Farm from "@/lib/farm/engine";
import { coinFormat, type ActFn, type ShopTab } from "./shared";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="fg-sheet-wrap">
      <button type="button" className="fg-sheet-backdrop" aria-label="Đóng" tabIndex={-1} onClick={onClose} />
      <div className="fg-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="fg-sheet__head">
          <h3>{title}</h3>
          <button ref={closeRef} type="button" className="fg-close" aria-label="Đóng" onClick={onClose}>×</button>
        </div>
        <div className="fg-sheet__body">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── market ───────────────────────── */

export function ShopSheet({ game, tab, onTab, onAct }: { game: Farm.GameState; tab: ShopTab; onTab: (tab: ShopTab) => void; onAct: ActFn }) {
  const level = Farm.levelFromXp(game.xp);
  const pondFull = game.pond.fish.length >= Farm.pondCapacity(game);
  const ranchFull = game.ranch.animals.length >= Farm.ranchCapacity(game);
  const unlock = Farm.nextPlotUnlock(game);
  const pond = Farm.nextPondUpgrade(game);
  const ranch = Farm.nextRanchUpgrade(game);
  const firstLocked = game.plots.findIndex((plot) => plot.status === "locked");
  const tabs: [ShopTab, string][] = [["seeds", "Hạt giống"], ["animals", "Vật nuôi"], ["fish", "Cá giống"], ["items", "Vật phẩm"], ["expand", "Mở rộng"]];
  return (
    <>
      <div className="fg-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTab(id)}>{label}</button>
        ))}
      </div>
      <p className="fg-wallet">🪙 {coinFormat.format(game.coins)} xu · cấp {level}</p>
      {tab === "seeds" ? (
        <ul className="fg-list">
          {Farm.CROPS.map((crop) => {
            const locked = level < crop.level;
            return (
              <li key={crop.id} data-locked={locked || undefined}>
                <span className="fg-list__icon" aria-hidden="true">{crop.emoji}</span>
                <div>
                  <strong>{crop.name}</strong>
                  <small>{locked ? `Mở ở cấp ${crop.level}` : `${Farm.formatDuration(crop.growSeconds)} · thu ${crop.yield} × ${crop.sellPrice} xu · +${crop.xp} XP · đang có ${game.seeds[crop.id] ?? 0}`}</small>
                </div>
                <div className="fg-list__buy">
                  <button type="button" disabled={locked || game.coins < crop.seedPrice} onClick={() => onAct((current) => Farm.buySeeds(current, crop.id, 1))}>{crop.seedPrice} xu</button>
                  <button type="button" disabled={locked || game.coins < crop.seedPrice * 5} onClick={() => onAct((current) => Farm.buySeeds(current, crop.id, 5))}>×5</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {tab === "animals" ? (
        <ul className="fg-list">
          {Farm.ANIMALS.map((animal) => {
            const locked = level < animal.level;
            const product = Farm.PRODUCT_MAP[animal.product];
            return (
              <li key={animal.id} data-locked={locked || undefined}>
                <span className="fg-list__icon" aria-hidden="true">{animal.emoji}</span>
                <div>
                  <strong>{animal.name}</strong>
                  <small>{locked ? `Mở ở cấp ${animal.level}` : `Mỗi ${Farm.formatDuration(animal.cycleSeconds)} ăn 1 phần, ra 1 ${product.emoji} ${product.name.toLowerCase()} (${product.sellPrice} xu)`}</small>
                </div>
                <div className="fg-list__buy">
                  <button type="button" disabled={locked || ranchFull || game.coins < animal.price} onClick={() => onAct((current) => Farm.buyAnimal(current, animal.id))}>
                    {ranchFull && !locked ? "Chuồng đầy" : `${animal.price} xu`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {tab === "fish" ? (
        <ul className="fg-list">
          {Farm.FISHES.map((fish) => {
            const locked = level < fish.level;
            return (
              <li key={fish.id} data-locked={locked || undefined}>
                <span className="fg-list__icon" style={{ background: fish.color }} aria-hidden="true">{fish.emoji}</span>
                <div>
                  <strong>{fish.name}</strong>
                  <small>{locked ? `Mở ở cấp ${fish.level}` : `Lớn sau ${Farm.formatDuration(fish.growSeconds)} khi no · bán ${fish.sellPrice} xu · +${fish.xp} XP`}</small>
                </div>
                <div className="fg-list__buy">
                  <button type="button" disabled={locked || pondFull || game.coins < fish.fryPrice} onClick={() => onAct((current) => Farm.buyFry(current, fish.id))}>
                    {pondFull && !locked ? "Ao đầy" : `${fish.fryPrice} xu`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {tab === "items" ? (
        <ul className="fg-list">
          {(Object.keys(Farm.ITEMS) as Farm.ItemId[]).map((id) => {
            const item = Farm.ITEMS[id];
            const bulk = id === "feed" ? 10 : 5;
            return (
              <li key={id}>
                <span className="fg-list__icon" aria-hidden="true">{item.emoji}</span>
                <div>
                  <strong>{item.name} <em>· đang có {game.items[id]}</em></strong>
                  <small>{item.note}</small>
                </div>
                <div className="fg-list__buy">
                  <button type="button" disabled={game.coins < item.price} onClick={() => onAct((current) => Farm.buyItem(current, id, 1))}>{item.price} xu</button>
                  <button type="button" disabled={game.coins < item.price * bulk} onClick={() => onAct((current) => Farm.buyItem(current, id, bulk))}>×{bulk}</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {tab === "expand" ? (
        <ul className="fg-list">
          <li>
            <span className="fg-list__icon" aria-hidden="true">🧱</span>
            <div>
              <strong>Thêm ô ruộng <em>· {Farm.unlockedPlotCount(game)}/{Farm.PLOT_COUNT}</em></strong>
              <small>{unlock ? `${unlock.cost} xu · cần cấp ${unlock.level}. Ô mới mọc cỏ, cần cuốc trước khi gieo.` : "Đã mở hết đất."}</small>
            </div>
            <div className="fg-list__buy">
              {unlock ? <button type="button" disabled={level < unlock.level || game.coins < unlock.cost} onClick={() => onAct((current) => Farm.unlockPlot(current, firstLocked))}>Mở</button> : null}
            </div>
          </li>
          <li>
            <span className="fg-list__icon" aria-hidden="true">🏡</span>
            <div>
              <strong>Mở rộng chuồng <em>· {Farm.ranchCapacity(game)} con</em></strong>
              <small>{ranch ? `${ranch.cost} xu · cần cấp ${ranch.level} · nuôi tối đa ${Farm.RANCH_CAPACITIES[game.ranch.capacityLevel + 1]} con.` : "Chuồng đã rộng nhất."}</small>
            </div>
            <div className="fg-list__buy">
              {ranch ? <button type="button" disabled={level < ranch.level || game.coins < ranch.cost} onClick={() => onAct((current) => Farm.upgradeRanch(current))}>Mở rộng</button> : null}
            </div>
          </li>
          <li>
            <span className="fg-list__icon" aria-hidden="true">🏞️</span>
            <div>
              <strong>Mở rộng ao <em>· {Farm.pondCapacity(game)} con</em></strong>
              <small>{pond ? `${pond.cost} xu · cần cấp ${pond.level} · nuôi tối đa ${Farm.POND_CAPACITIES[game.pond.capacityLevel + 1]} con.` : "Ao đã rộng nhất."}</small>
            </div>
            <div className="fg-list__buy">
              {pond ? <button type="button" disabled={level < pond.level || game.coins < pond.cost} onClick={() => onAct((current) => Farm.upgradePond(current))}>Mở rộng</button> : null}
            </div>
          </li>
        </ul>
      ) : null}
    </>
  );
}

/* ───────────────────────── barn ───────────────────────── */

export function BarnSheet({ game, today, onAct, onTruck }: { game: Farm.GameState; today: string; onAct: ActFn; onTruck: () => void }) {
  const featured = Farm.featuredToday(today);
  const entries = Farm.barnEntries(game, today);
  const total = Farm.barnValue(game, today);
  const seeds = Farm.CROPS.filter((crop) => (game.seeds[crop.id] ?? 0) > 0);
  return (
    <>
      <p className="fg-featured">
        Giá tốt hôm nay (+25%): {Farm.CROP_MAP[featured.crop].emoji} {Farm.CROP_MAP[featured.crop].name} và {Farm.FISH_MAP[featured.fish].emoji} {Farm.FISH_MAP[featured.fish].name}. Chở lên phố bằng xe tải được thêm +{Math.round((Farm.TRUCK.bonus - 1) * 100)}%.
      </p>
      {entries.length === 0 ? <p className="fg-empty">Kho trống. Thu hoạch rau, vớt cá hoặc nhặt sản phẩm ở trang trại để có hàng bán.</p> : null}
      <ul className="fg-list">
        {entries.map((entry) => (
          <li key={entry.key}>
            <span className="fg-list__icon" aria-hidden="true">{entry.emoji}</span>
            <div>
              <strong>{entry.name} <em>× {entry.owned}</em></strong>
              <small>{entry.price} xu mỗi phần tại chỗ{entry.featured ? " · ⭐ giá tốt" : ""}</small>
            </div>
            <div className="fg-list__buy">
              <button type="button" onClick={() => onAct((current) => Farm.sellGoods(current, entry.kind, entry.id, 1, today))}>Bán 1</button>
              <button type="button" onClick={() => onAct((current) => Farm.sellGoods(current, entry.kind, entry.id, entry.owned, today))}>+{entry.price * entry.owned}</button>
            </div>
          </li>
        ))}
      </ul>
      {total > 0 ? (
        <div className="fg-split">
          <button type="button" className="fg-wide fg-wide--ghost" onClick={() => onAct((current) => Farm.sellAll(current, today))}>💰 Bán hết tại chỗ · +{coinFormat.format(total)}</button>
          <button type="button" className="fg-wide" onClick={onTruck}>🚚 Chở lên phố · giá cao hơn</button>
        </div>
      ) : null}
      <div className="fg-inventory">
        <p><strong>Túi đồ</strong></p>
        <p>
          {seeds.length ? seeds.map((crop) => `${crop.emoji} ${game.seeds[crop.id]}`).join(" · ") : "Chưa có hạt giống"} · ✨ {game.items.fertilizer} phân bón · 🍞 {game.items.fishFood} cám · 🥣 {game.items.feed} thức ăn
        </p>
        <p className="fg-muted">Đã thu hoạch {game.stats.harvested} nông sản · vớt {game.stats.fishCaught} cá · kiếm {coinFormat.format(game.stats.earned)} xu.</p>
      </div>
    </>
  );
}

/* ───────────────────────── seeds ───────────────────────── */

export function SeedSheet({
  game,
  current,
  pending,
  onChoose,
  onShop,
}: {
  game: Farm.GameState;
  current: Farm.CropId;
  pending: boolean;
  onChoose: (crop: Farm.CropId) => void;
  onShop: () => void;
}) {
  const owned = Farm.CROPS.filter((crop) => (game.seeds[crop.id] ?? 0) > 0);
  return (
    <>
      {pending ? <p className="fg-muted">Chọn hạt để gieo ngay vào ô vừa chạm.</p> : null}
      {owned.length === 0 ? <p className="fg-empty">Túi hạt đang trống.</p> : null}
      <div className="fg-seed-grid">
        {owned.map((crop) => (
          <button key={crop.id} type="button" aria-pressed={crop.id === current} onClick={() => onChoose(crop.id)}>
            <span aria-hidden="true">{crop.emoji}</span>
            <strong>{crop.name}</strong>
            <small>còn {game.seeds[crop.id]} · {Farm.formatDuration(crop.growSeconds)}</small>
          </button>
        ))}
      </div>
      <button type="button" className="fg-wide" onClick={onShop}>🏪 Mua thêm hạt ở chợ</button>
    </>
  );
}

/* ───────────────────────── ranch sheets ───────────────────────── */

export function MillSheet({ game, onAct, onShop }: { game: Farm.GameState; onAct: ActFn; onShop: () => void }) {
  const crops = Farm.CROPS.filter((crop) => (game.barn.crops[crop.id] ?? 0) > 0);
  const eatersPerHour = game.ranch.animals.reduce((sum, animal) => sum + 3600 / Farm.ANIMAL_MAP[animal.species].cycleSeconds, 0);
  return (
    <>
      <p className="fg-featured">
        Máng đang có <strong>🥣 {game.items.feed} phần</strong>. Mỗi con ăn 1 phần cho mỗi lượt ra sản phẩm
        {eatersPerHour > 0 ? ` — cả chuồng ăn khoảng ${Math.round(eatersPerHour)} phần mỗi giờ.` : "."}
      </p>
      <p className="fg-muted">Xay nông sản trong kho thành thức ăn. Lúa, ngô, hướng dương, bí ngô và dưa hấu cho nhiều phần nhất.</p>
      {crops.length === 0 ? <p className="fg-empty">Kho chưa có nông sản để xay. Thu hoạch ở ruộng hoặc mua thức ăn ở chợ.</p> : null}
      <ul className="fg-list">
        {crops.map((crop) => {
          const owned = game.barn.crops[crop.id] ?? 0;
          const ratio = Farm.MILL_YIELD[crop.id];
          return (
            <li key={crop.id}>
              <span className="fg-list__icon" aria-hidden="true">{crop.emoji}</span>
              <div>
                <strong>{crop.name} <em>× {owned}</em></strong>
                <small>1 {crop.name.toLowerCase()} → {ratio} phần thức ăn (bán tại chỗ được {Farm.CROP_MAP[crop.id].sellPrice} xu)</small>
              </div>
              <div className="fg-list__buy">
                <button type="button" onClick={() => onAct((current) => Farm.millCrop(current, crop.id, 1))}>Xay 1</button>
                <button type="button" onClick={() => onAct((current) => Farm.millCrop(current, crop.id, owned))}>+{ratio * owned}</button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="fg-wide fg-wide--ghost" onClick={onShop}>🏪 Mua thức ăn ở chợ ({Farm.ITEMS.feed.price} xu/phần)</button>
    </>
  );
}

export function WorkshopSheet({ game, onAct }: { game: Farm.GameState; onAct: ActFn }) {
  const level = Farm.levelFromXp(game.xp);
  return (
    <ul className="fg-list fg-list--tall">
      {Farm.WORKSHOPS.map((def) => {
        const state = game.ranch.workshops[def.id];
        const good = Farm.GOOD_MAP[def.output];
        const locked = level < def.level;
        let status: ReactNode;
        let action: ReactNode = null;
        if (!state) {
          status = locked ? `Mở ở cấp ${def.level}` : `Xây với ${def.buildCost} xu`;
          action = (
            <button type="button" disabled={locked || game.coins < def.buildCost} onClick={() => onAct((current) => Farm.buildWorkshop(current, def.id))}>
              Xây
            </button>
          );
        } else if (state.ready > 0) {
          status = `Có ${state.ready} ${good.name.toLowerCase()} chờ lấy`;
          action = <button type="button" onClick={() => onAct((current) => Farm.collectWorkshop(current, def.id))}>Lấy hàng</button>;
        } else if (state.progress !== null) {
          const ratio = state.progress / def.seconds;
          status = (
            <>
              <span className="fg-progress" aria-hidden="true"><em style={{ width: `${Math.round(ratio * 100)}%` }} /></span>
              Đang làm · xong sau {Farm.formatDuration(def.seconds - state.progress)}
            </>
          );
        } else {
          const ready = Farm.canStartWorkshop(game, def.id);
          status = ready ? "Đủ nguyên liệu" : "Thiếu nguyên liệu trong kho";
          action = <button type="button" disabled={!ready} onClick={() => onAct((current) => Farm.startWorkshop(current, def.id))}>Làm</button>;
        }
        return (
          <li key={def.id} data-locked={(locked && !state) || undefined}>
            <span className="fg-list__icon" style={{ background: `${def.roof}33` }} aria-hidden="true">{good.emoji}</span>
            <div>
              <strong>{def.name}</strong>
              <small>{Farm.workshopInputsText(def)} → 1 {good.name.toLowerCase()} ({good.sellPrice} xu) · {Farm.formatDuration(def.seconds)}</small>
              <small className="fg-status">{status}</small>
            </div>
            <div className="fg-list__buy">{action}</div>
          </li>
        );
      })}
    </ul>
  );
}

export function TruckSheet({ game, today, onAct }: { game: Farm.GameState; today: string; onAct: ActFn }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const entries = Farm.barnEntries(game, today);
  const loaded = Farm.truckValue(game, cart, today);
  const trip = game.ranch.truck;
  if (trip) {
    return (
      <div className="fg-truck-away">
        <p className="fg-truck-road" aria-hidden="true"><span>🚚</span></p>
        <p>Xe đang chở {trip.items} món lên phố, về sau <strong>{Farm.formatDuration((trip.returnAt - game.lastTick) / 1000)}</strong> với <strong>{coinFormat.format(trip.value)} xu</strong>.</p>
        <p className="fg-muted">Tiền vào ví tự động khi xe về, kể cả khi bạn đã đóng trang.</p>
      </div>
    );
  }
  const room = Farm.TRUCK.capacity - loaded.items;
  function change(key: string, owned: number, delta: number) {
    setCart((current) => {
      const next = Math.max(0, Math.min(owned, (current[key] ?? 0) + delta));
      return { ...current, [key]: next };
    });
  }
  function fillUp() {
    let space = Farm.TRUCK.capacity;
    const next: Record<string, number> = {};
    // Most valuable goods first.
    for (const entry of [...entries].sort((a, b) => b.price - a.price)) {
      const take = Math.min(entry.owned, space);
      if (take > 0) next[entry.key] = take;
      space -= take;
      if (space <= 0) break;
    }
    setCart(next);
  }
  return (
    <>
      <p className="fg-featured">
        Xe chở tối đa {Farm.TRUCK.capacity} món, đi về mất {Farm.formatDuration(Farm.TRUCK.tripSeconds)} và bán được giá cao hơn {Math.round((Farm.TRUCK.bonus - 1) * 100)}% so với bán tại kho.
      </p>
      {entries.length === 0 ? <p className="fg-empty">Kho trống — chưa có gì để chở.</p> : null}
      <ul className="fg-list">
        {entries.map((entry) => {
          const qty = Math.min(entry.owned, cart[entry.key] ?? 0);
          return (
            <li key={entry.key}>
              <span className="fg-list__icon" aria-hidden="true">{entry.emoji}</span>
              <div>
                <strong>{entry.name} <em>· có {entry.owned}</em></strong>
                <small>{Math.round(entry.price * Farm.TRUCK.bonus)} xu mỗi phần ở phố</small>
              </div>
              <div className="fg-stepper">
                <button type="button" aria-label={`Bớt ${entry.name}`} disabled={qty === 0} onClick={() => change(entry.key, entry.owned, -1)}>−</button>
                <output aria-live="polite">{qty}</output>
                <button type="button" aria-label={`Thêm ${entry.name}`} disabled={qty >= entry.owned || room <= 0} onClick={() => change(entry.key, entry.owned, Math.min(room, 1))}>+</button>
              </div>
            </li>
          );
        })}
      </ul>
      {entries.length ? (
        <div className="fg-split">
          <button type="button" className="fg-wide fg-wide--ghost" onClick={fillUp}>Chất đầy xe</button>
          <button
            type="button"
            className="fg-wide"
            disabled={loaded.items === 0}
            onClick={() => {
              const at = Date.now();
              const load = cart;
              onAct((current) => Farm.sendTruck(current, load, at, today));
              setCart({});
            }}
          >
            🚚 Chở {loaded.items}/{Farm.TRUCK.capacity} món · {coinFormat.format(loaded.value)} xu
          </button>
        </div>
      ) : null}
    </>
  );
}

/* ───────────────────────── gifts & help ───────────────────────── */

export function GiftSheet({
  game,
  today,
  practice,
  dailyReady,
  onAct,
}: {
  game: Farm.GameState;
  today: string;
  practice: { draft: boolean; revision: boolean };
  dailyReady: boolean;
  onAct: ActFn;
}) {
  const studyClaimed = game.lastStudyReward === today;
  return (
    <div className="fg-gifts">
      <article>
        <h4>👋 Quà ghé thăm</h4>
        <p>Mỗi ngày một lần: +{Farm.DAILY_BONUS.coins} xu và +{Farm.DAILY_BONUS.fishFood} cám cá.</p>
        <button type="button" disabled={!dailyReady} onClick={() => onAct((current) => Farm.claimDailyBonus(current, today))}>
          {dailyReady ? "Nhận quà" : "Đã nhận hôm nay"}
        </button>
      </article>
      <article>
        <h4>📚 Quà học tập</h4>
        <p>
          Lưu ít nhất một bài luyện hôm nay trên thiết bị này: +{Farm.STUDY_REWARD.coins} xu, +{Farm.STUDY_REWARD.fertilizer} phân bón, thêm +
          {Farm.STUDY_REWARD.revisionFertilizer} nếu có bản luyện lại.
        </p>
        <p className="fg-muted">
          {practice.draft
            ? practice.revision
              ? "Đã thấy bản làm và bản luyện lại hôm nay."
              : "Đã thấy bản làm hôm nay. Luyện lại để có thêm phân bón."
            : "Chưa thấy bài luyện nào được lưu hôm nay."}{" "}
          Quà chỉ đọc bản nháp trên máy, không đánh dấu bài đã xong hay đã được review.
        </p>
        <div className="fg-card__actions">
          <button type="button" disabled={!practice.draft || studyClaimed} onClick={() => onAct((current) => Farm.claimStudyReward(current, today, practice))}>
            {studyClaimed ? "Đã nhận hôm nay" : "Nhận quà học tập"}
          </button>
          <Link href="/learning/daily" className="fg-link">Mở bài 5 phút hôm nay →</Link>
        </div>
      </article>
    </div>
  );
}

export function HelpSheet() {
  return (
    <ol className="fg-help">
      <li><strong>Ruộng:</strong> chạm ô đất bằng 👋 Tay để tự làm việc phù hợp — cuốc, gieo, chăm hoặc thu hoạch. Các công cụ bên dưới làm từng việc riêng.</li>
      <li><strong>Chăm cây:</strong> 💧 đất khô làm cây lớn chậm một nửa; 🌿 cỏ và 🐛 sâu làm mất sản lượng lúc thu hoạch. ⭐ là cây đã chín.</li>
      <li><strong>Ao cá:</strong> mua cá giống ở chợ, cho ăn để cá lớn đủ tốc độ, vớt rác để nước sạch. Cá có ⭐ là đã lớn — chạm để vớt.</li>
      <li><strong>Trang trại:</strong> gà, vịt, cừu, bò tự ăn từ máng và đẻ trứng, cho len, sữa. Chạm sản phẩm trên cỏ (hoặc nút 🧺) để nhặt. Con có biểu tượng bát là đang chờ thức ăn.</li>
      <li><strong>Xưởng:</strong> trứng vịt thành trứng muối, trứng gà + lúa thành bánh, len thành khăn, sữa thành phô mai — đắt hơn bán thô.</li>
      <li><strong>Bán hàng:</strong> bán ngay tại kho, hoặc chất lên 🚚 xe tải chở lên phố để được giá cao hơn. Mỗi ngày có một món rau và một loại cá được giá +25%.</li>
      <li><strong>Lên cấp:</strong> mọi việc đều cho XP. Cấp cao mở cây, cá, vật nuôi, xưởng và đất mới.</li>
      <li><strong>Học mỗi ngày:</strong> lưu một bài luyện 5 phút để nhận quà học tập trong mục 🎁.</li>
    </ol>
  );
}
