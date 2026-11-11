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
  const season = Farm.gameClock(game, game.lastTick).season;
  const pondFull = game.pond.fish.length >= Farm.pondCapacity(game);
  const ranchFull = game.ranch.animals.length >= Farm.ranchCapacity(game);
  const unlock = Farm.nextPlotUnlock(game);
  const pond = Farm.nextPondUpgrade(game);
  const ranch = Farm.nextRanchUpgrade(game);
  const catCost = Farm.nextCatCost(game);
  const firstLocked = game.plots.findIndex((plot) => plot.status === "locked");
  const spot = Farm.nextSpotUnlock(game);
  const firstLockedSpot = game.orchard.spots.findIndex((item) => item.status === "locked");
  const tabs: [ShopTab, string][] = [["seeds", "Hạt giống"], ["trees", "Cây ăn quả"], ["animals", "Vật nuôi"], ["fish", "Cá giống"], ["items", "Vật phẩm"], ["expand", "Mở rộng"]];
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
                  <small>
                    {locked
                      ? `Mở ở cấp ${crop.level}`
                      : `${Farm.formatSpan(crop.growSeconds)}${crop.harvests > 1 ? `, rồi ${crop.harvests - 1} lứa nữa, mỗi lứa ${Farm.formatGameSpan(crop.regrowSeconds)}` : ""} · thu ${crop.yield} × ${crop.sellPrice} xu · mùa: ${Farm.seasonNames(crop.seasons)}${Farm.inSeason(crop.seasons, season) ? "" : " (đang trái mùa)"} · đang có ${game.seeds[crop.id] ?? 0}`}
                  </small>
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
      {tab === "trees" ? (
        <ul className="fg-list">
          {Farm.TREES.map((tree) => {
            const locked = level < tree.level;
            return (
              <li key={tree.id} data-locked={locked || undefined}>
                <span className="fg-list__icon" aria-hidden="true">{tree.emoji}</span>
                <div>
                  <strong>{tree.name} <em>· đang có {game.saplings[tree.id] ?? 0}</em></strong>
                  <small>{locked ? `Mở ở cấp ${tree.level}` : `Lớn sau ${Farm.formatSpan(tree.growSeconds)}, rồi cứ ${Farm.formatGameSpan(tree.fruitSeconds)} ra ${tree.yield} × ${tree.sellPrice} xu · mùa quả: ${Farm.seasonNames(tree.seasons)}`}</small>
                </div>
                <div className="fg-list__buy">
                  <button type="button" disabled={locked || game.coins < tree.saplingPrice} onClick={() => onAct((current) => Farm.buySapling(current, tree.id, 1))}>{tree.saplingPrice} xu</button>
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
                  <strong>{animal.young}</strong>
                  <small>{locked ? `Mở ở cấp ${animal.level}` : `Ăn đủ thì lớn sau ${Farm.formatSpan(animal.growSeconds)}; lớn rồi cứ ${Farm.formatGameSpan(animal.cycleSeconds)} ban ngày ăn 1 phần, ra 1 ${product.emoji} ${product.name.toLowerCase()} (${product.sellPrice} xu). Đêm ngủ.`}</small>
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
            const bulk = id === "feed" || id === "bait" ? 10 : 5;
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
            <span className="fg-list__icon" aria-hidden="true">🌳</span>
            <div>
              <strong>Thêm chỗ trồng cây <em>· {Farm.unlockedSpotCount(game)}/{Farm.ORCHARD_SPOTS}</em></strong>
              <small>{spot ? `${spot.cost} xu · cần cấp ${spot.level}. Chỗ mới là bãi cỏ, đào hố rồi trồng.` : "Đã mở hết vườn."}</small>
            </div>
            <div className="fg-list__buy">
              {spot ? <button type="button" disabled={level < spot.level || game.coins < spot.cost} onClick={() => onAct((current) => Farm.unlockSpot(current, firstLockedSpot))}>Mở</button> : null}
            </div>
          </li>
          <li>
            <span className="fg-list__icon" aria-hidden="true">🏡</span>
            <div>
              <strong>Mở rộng chuồng <em>· {Farm.ranchCapacity(game)} con</em></strong>
              <small>{ranch ? `${ranch.cost} xu · cần cấp ${ranch.level} · nuôi tối đa ${Farm.RANCH_CAPACITIES[game.ranch.capacityLevel + 1]} con · các chuồng to ra, thêm rơm, cỏ khô và đồ trang trí.` : "Chuồng đã rộng nhất."}</small>
            </div>
            <div className="fg-list__buy">
              {ranch ? <button type="button" disabled={level < ranch.level || game.coins < ranch.cost} onClick={() => onAct((current) => Farm.upgradeRanch(current))}>Mở rộng</button> : null}
            </div>
          </li>
          <li>
            <span className="fg-list__icon" aria-hidden="true">🐈</span>
            <div>
              <strong>Mèo nhặt đồ <em>· {game.ranch.cats ?? 0}/{Farm.CAT.costs.length} con</em></strong>
              <small>{catCost !== null ? `${catCost} xu · cần cấp ${Farm.CAT.level} · mèo tự nhặt trứng, sữa, len vào kho.` : "Trại đã đủ mèo."}</small>
            </div>
            <div className="fg-list__buy">
              {catCost !== null ? <button type="button" disabled={level < Farm.CAT.level || game.coins < catCost} onClick={() => onAct((current) => Farm.buyCat(current))}>Nuôi</button> : null}
            </div>
          </li>
          <li>
            <span className="fg-list__icon" aria-hidden="true">🐕</span>
            <div>
              <strong>Chó giữ trại{game.ranch.dog ? <em> · đã có</em> : null}</strong>
              <small>{game.ranch.dog ? "Gấu tới là chó đuổi đi ngay." : `${Farm.DOG.cost} xu · cần cấp ${Farm.DOG.level} · gấu tới là chó đuổi đi ngay.`}</small>
            </div>
            <div className="fg-list__buy">
              {game.ranch.dog ? null : <button type="button" disabled={level < Farm.DOG.level || game.coins < Farm.DOG.cost} onClick={() => onAct((current) => Farm.buyDog(current))}>Nuôi</button>}
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
  const saplings = Farm.TREES.filter((tree) => (game.saplings[tree.id] ?? 0) > 0);
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
          {seeds.length ? seeds.map((crop) => `${crop.emoji} ${game.seeds[crop.id]}`).join(" · ") : "Chưa có hạt giống"}
          {saplings.length ? ` · cây giống ${saplings.map((tree) => `${tree.emoji} ${game.saplings[tree.id]}`).join(" ")}` : ""} · ✨ {game.items.fertilizer} phân bón · 🍞 {game.items.fishFood} cám · 🥣 {game.items.feed} thức ăn · 🪱 {game.items.bait} mồi câu
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
  const season = Farm.gameClock(game, game.lastTick).season;
  return (
    <>
      {pending ? <p className="fg-muted">Chọn hạt để gieo ngay vào ô vừa chạm.</p> : null}
      {owned.length === 0 ? <p className="fg-empty">Túi hạt đang trống.</p> : null}
      <div className="fg-seed-grid">
        {owned.map((crop) => (
          <button key={crop.id} type="button" aria-pressed={crop.id === current} onClick={() => onChoose(crop.id)}>
            <span aria-hidden="true">{crop.emoji}</span>
            <strong>{crop.name}</strong>
            <small>còn {game.seeds[crop.id]} · {Farm.formatGameSpan(crop.growSeconds)}{Farm.inSeason(crop.seasons, season) ? "" : " · trái mùa"}</small>
          </button>
        ))}
      </div>
      <button type="button" className="fg-wide" onClick={onShop}>🏪 Mua thêm hạt ở chợ</button>
    </>
  );
}

export function SaplingSheet({
  game,
  current,
  pending,
  onChoose,
  onShop,
}: {
  game: Farm.GameState;
  current: Farm.FruitId;
  pending: boolean;
  onChoose: (fruit: Farm.FruitId) => void;
  onShop: () => void;
}) {
  const owned = Farm.TREES.filter((tree) => (game.saplings[tree.id] ?? 0) > 0);
  return (
    <>
      {pending ? <p className="fg-muted">Chọn cây để trồng ngay vào hố vừa chạm.</p> : null}
      {owned.length === 0 ? <p className="fg-empty">Chưa có cây giống nào.</p> : null}
      <div className="fg-seed-grid">
        {owned.map((tree) => (
          <button key={tree.id} type="button" aria-pressed={tree.id === current} onClick={() => onChoose(tree.id)}>
            <span aria-hidden="true">{tree.emoji}</span>
            <strong>{tree.name}</strong>
            <small>còn {game.saplings[tree.id]} · quả mỗi {Farm.formatGameSpan(tree.fruitSeconds)}</small>
          </button>
        ))}
      </div>
      <button type="button" className="fg-wide" onClick={onShop}>🏪 Mua cây giống ở chợ</button>
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
        const locked = level < def.level;
        const shopLevel = Farm.workshopLevel(state);
        const recipes = Farm.workshopRecipes(def.id);
        const upgradeCost = Farm.workshopUpgradeCost(game, def.id);
        const batch = Farm.WORKSHOP_BATCH[shopLevel - 1];
        let status: ReactNode;
        let action: ReactNode = null;
        if (!state) {
          status = locked ? `Mở ở cấp ${def.level}` : `Xây với ${def.buildCost} xu`;
          action = (
            <button type="button" disabled={locked || game.coins < def.buildCost} onClick={() => onAct((current) => Farm.buildWorkshop(current, def.id))}>
              Xây
            </button>
          );
        } else if (state.progress !== null) {
          const seconds = Farm.workshopSeconds(def.id, state);
          const made = Farm.GOOD_MAP[recipes[state.recipe === 1 ? 1 : 0].output];
          status = (
            <>
              <span className="fg-progress" aria-hidden="true"><em style={{ width: `${Math.round((state.progress / seconds) * 100)}%` }} /></span>
              Đang làm {state.batch && state.batch > 1 ? `${state.batch} ` : ""}{made.name.toLowerCase()} · xong sau {Farm.formatDuration(seconds - state.progress)}
            </>
          );
        } else if (state.ready > 0) {
          const made = Farm.GOOD_MAP[recipes[state.readyRecipe === 1 ? 1 : 0].output];
          status = `Có ${state.ready} ${made.name.toLowerCase()} chờ lấy`;
        } else status = "Đang nghỉ";
        return (
          <li key={def.id} data-locked={(locked && !state) || undefined} className="fg-shop-row">
            <span className="fg-list__icon" style={{ background: `${def.roof}33` }} aria-hidden="true">{Farm.GOOD_MAP[def.output].emoji}</span>
            <div>
              <strong>{def.name}{state ? <em> · cấp {shopLevel}</em> : null}</strong>
              <small className="fg-status">{status}</small>
              {state && state.ready > 0 ? (
                <button type="button" className="fg-recipe" onClick={() => onAct((current) => Farm.collectWorkshop(current, def.id))}>⭐ Lấy {state.ready} món đã xong</button>
              ) : null}
              {recipes.map((recipe, index) => {
                const good = Farm.GOOD_MAP[recipe.output];
                const open = index === 0 || shopLevel >= 2;
                const batches = state ? Farm.workshopBatches(game, def.id, index) : 0;
                return (
                  <div key={recipe.output} className="fg-recipe-row" data-locked={!open || undefined}>
                    <small>
                      {good.emoji} {Farm.workshopInputsText(recipe)} → {good.name.toLowerCase()} ({good.sellPrice} xu) · {Farm.formatDuration(state ? Farm.workshopSeconds(def.id, state, index) : recipe.seconds)}
                      {!open ? " · mở ở xưởng cấp 2" : ""}
                    </small>
                    {state && open ? (
                      <button type="button" disabled={batches < 1} aria-label={`Làm ${good.name}`} onClick={() => onAct((current) => Farm.startWorkshop(current, def.id, index))}>
                        Làm{batches > 1 ? ` ×${batches}` : ""}
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {state ? (
                <small>
                  {upgradeCost === null
                    ? `Cấp cao nhất: ${batch} mẻ một lúc.`
                    : shopLevel === 1
                      ? `Lên cấp 2 (${upgradeCost} xu): mở món ${Farm.GOOD_MAP[recipes[1].output].name.toLowerCase()}.`
                      : `Lên cấp ${shopLevel + 1} (${upgradeCost} xu): nhanh hơn, ${Farm.WORKSHOP_BATCH[shopLevel]} mẻ một lúc.`}
                </small>
              ) : null}
            </div>
            <div className="fg-list__buy">
              {action}
              {state && upgradeCost !== null ? (
                <button type="button" disabled={game.coins < upgradeCost} aria-label={`Nâng cấp ${def.name}, ${upgradeCost} xu`} onClick={() => onAct((current) => Farm.upgradeWorkshop(current, def.id))}>
                  ⬆️ {upgradeCost}
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Standing orders: deliver what is asked from the barn for a reward above the market price. */
export function OrdersSheet({ game, onAct }: { game: Farm.GameState; onAct: ActFn }) {
  const orders = game.ranch.orders ?? [];
  return (
    <>
      <p className="fg-featured">Giao đủ hàng trong kho để nhận thưởng cao hơn giá chợ. Đã giao {game.ranch.ordersDone ?? 0} đơn — càng giao nhiều, đơn càng lớn.</p>
      {orders.length === 0 ? <p className="fg-empty">Đơn mới sắp tới…</p> : null}
      <ul className="fg-list fg-list--tall">
        {orders.map((order) => {
          const ready = Farm.canFillOrder(game, order);
          return (
            <li key={order.id} className="fg-shop-row">
              <span className="fg-list__icon" aria-hidden="true">📦</span>
              <div>
                <strong>Thưởng {coinFormat.format(order.reward)} xu <em>· +{order.xp} XP</em></strong>
                {order.items.map((item) => {
                  const info = Farm.orderItemInfo(item);
                  const owned = Farm.barnCount(game, item.kind, item.id);
                  return (
                    <small key={`${item.kind}:${item.id}`} className={owned >= item.qty ? undefined : "fg-warn"}>
                      {info.emoji} {item.qty} {info.name.toLowerCase()} · có {Math.min(owned, item.qty)}/{item.qty}
                    </small>
                  );
                })}
              </div>
              <div className="fg-list__buy">
                <button type="button" disabled={!ready} onClick={() => onAct((current) => Farm.fillOrder(current, order.id))}>Giao</button>
                <button type="button" disabled={game.coins < Farm.ORDER_SWAP_COST} aria-label={`Đổi đơn khác, ${Farm.ORDER_SWAP_COST} xu`} onClick={() => onAct((current) => Farm.swapOrder(current, order.id))}>
                  🔄 {Farm.ORDER_SWAP_COST}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function IncubatorSheet({ game, onAct }: { game: Farm.GameState; onAct: ActFn }) {
  const level = Farm.levelFromXp(game.xp);
  const incubator = game.ranch.incubator;
  if (!incubator) {
    const locked = level < Farm.INCUBATOR.level;
    return (
      <>
        <p className="fg-muted">
          Lò giữ ấm trứng gà và trứng vịt lấy từ kho. Trứng gà nở sau {Farm.formatSpan(Farm.HATCH.egg.seconds)}, trứng vịt sau {Farm.formatSpan(Farm.HATCH.duckEgg.seconds)}, thành con non cho trang trại — không phải mua.
          Như lò ấp thật, trứng cần được đảo ít nhất mỗi {Farm.formatGameSpan(Farm.INCUBATOR.turnSeconds)}; vài ngày cuối thì để yên. Lò chứa {Farm.INCUBATOR.slots} quả.
        </p>
        <button type="button" className="fg-wide" disabled={locked || game.coins < Farm.INCUBATOR.buildCost} onClick={() => onAct((current) => Farm.buildIncubator(current))}>
          {locked ? `🔒 Mở ở cấp ${Farm.INCUBATOR.level}` : `🔨 Xây lò ấp · ${Farm.INCUBATOR.buildCost} xu`}
        </button>
      </>
    );
  }
  const hatched = incubator.eggs.filter(Farm.isHatched).length;
  const needTurn = incubator.eggs.some(Farm.eggNeedsTurn);
  const free = Farm.INCUBATOR.slots - incubator.eggs.length;
  const space = Farm.ranchCapacity(game) - game.ranch.animals.length;
  return (
    <>
      <ul className="fg-list">
        {incubator.eggs.map((egg) => {
          const def = Farm.HATCH[egg.kind];
          const young = Farm.ANIMAL_MAP[def.species].young;
          const done = Farm.isHatched(egg);
          const stalled = Farm.eggNeedsTurn(egg);
          const ratio = Math.min(1, egg.progress / def.seconds);
          const lockdown = ratio >= Farm.INCUBATOR.lockdown;
          return (
            <li key={egg.id}>
              <span className="fg-list__icon" aria-hidden="true">{done ? (egg.kind === "egg" ? "🐤" : "🦆") : "🥚"}</span>
              <div>
                <strong>{Farm.PRODUCT_MAP[egg.kind].name} → {young}</strong>
                <small className="fg-status">
                  <span className="fg-progress" aria-hidden="true"><em style={{ width: `${Math.round(ratio * 100)}%` }} /></span>
                  {done
                    ? `Đã nở! ${young} chờ ra chuồng.`
                    : stalled
                      ? "⚠️ Lâu chưa đảo, trứng ngừng phát triển. Đảo trứng ngay."
                      : `Nở sau ${Farm.formatSpan(Farm.eggSecondsLeft(egg))}${lockdown ? " · sắp nở, để yên" : ""}.`}
                </small>
              </div>
            </li>
          );
        })}
        {Array.from({ length: free }, (_, index) => (
          <li key={`free${index}`} data-locked>
            <span className="fg-list__icon" aria-hidden="true">◌</span>
            <div><strong>Ô trống</strong><small>Đặt một quả trứng từ kho.</small></div>
          </li>
        ))}
      </ul>
      <div className="fg-card__actions">
        {(["egg", "duckEgg"] as const).map((kind) => (
          <button key={kind} type="button" disabled={free < 1 || (game.barn.products[kind] ?? 0) < 1} onClick={() => onAct((current) => Farm.setEgg(current, kind))}>
            🥚 Đặt {Farm.PRODUCT_MAP[kind].name.toLowerCase()} (có {game.barn.products[kind] ?? 0})
          </button>
        ))}
        <button type="button" data-alert={needTurn || undefined} onClick={() => onAct((current) => Farm.turnEggs(current))}>🔄 Đảo trứng</button>
        <button type="button" disabled={hatched < 1 || space < 1} onClick={() => onAct((current) => Farm.collectHatchlings(current))}>
          🐣 Đưa ra chuồng ({hatched})
        </button>
      </div>
      {hatched > 0 && space < 1 ? <p className="fg-warn">Chuồng đã đầy — mở rộng trang trại ở chợ để đón con non.</p> : null}
    </>
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
  const spec = Farm.truckSpec(game);
  const upgrade = Farm.nextTruckUpgrade(game);
  const room = spec.capacity - loaded.items;
  function change(key: string, owned: number, delta: number) {
    setCart((current) => {
      const next = Math.max(0, Math.min(owned, (current[key] ?? 0) + delta));
      return { ...current, [key]: next };
    });
  }
  function fillUp() {
    let space = spec.capacity;
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
        Xe chở tối đa {spec.capacity} món, đi về mất {Farm.formatDuration(spec.tripSeconds)} và bán được giá cao hơn {Math.round((spec.bonus - 1) * 100)}% so với bán tại kho.
      </p>
      {upgrade ? (
        <div className="fg-recipe-row">
          <small>🚚 Xe mới ({upgrade.cost} xu · cần cấp {upgrade.level}): chở {upgrade.capacity} món, đi {Farm.formatDuration(upgrade.tripSeconds)}, giá phố +{Math.round((upgrade.bonus - 1) * 100)}%.</small>
          <button type="button" disabled={game.coins < upgrade.cost || Farm.levelFromXp(game.xp) < upgrade.level} onClick={() => onAct((current) => Farm.upgradeTruck(current))}>Đổi xe</button>
        </div>
      ) : null}
      {entries.length === 0 ? <p className="fg-empty">Kho trống — chưa có gì để chở.</p> : null}
      <ul className="fg-list">
        {entries.map((entry) => {
          const qty = Math.min(entry.owned, cart[entry.key] ?? 0);
          return (
            <li key={entry.key}>
              <span className="fg-list__icon" aria-hidden="true">{entry.emoji}</span>
              <div>
                <strong>{entry.name} <em>· có {entry.owned}</em></strong>
                <small>{Math.round(entry.price * spec.bonus)} xu mỗi phần ở phố</small>
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
            🚚 Chở {loaded.items}/{spec.capacity} món · {coinFormat.format(loaded.value)} xu
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
        <p>Mỗi ngày một lần: +{Farm.DAILY_BONUS.coins} xu, +{Farm.DAILY_BONUS.fishFood} cám cá và +{Farm.DAILY_BONUS.bait} mồi câu.</p>
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
      <li><strong>Phóng to, nhìn quanh:</strong> nút + và − ở bên trái (hoặc chụm hai ngón, Ctrl + cuộn chuột) để phóng to; khi đã phóng to, kéo trên chỗ đất trống để nhìn quanh, nút ⤢ để về khung ban đầu. Trên điện thoại, kéo ngang để xem phần hai bên.</li>
      <li><strong>Ruộng:</strong> chạm ô đất bằng 👋 Tay để tự làm việc phù hợp — cuốc, gieo, chăm hoặc thu hoạch. Các công cụ bên dưới làm từng việc riêng. Giữ và kéo công cụ qua nhiều ô để làm một lượt.</li>
      <li><strong>Ngày và mùa:</strong> một ngày trong nông trại dài 24 phút thật (một giờ game là một phút thật), có sáng, chiều, tối, đêm. Mỗi mùa xuân, hạ, thu, đông kéo dài 7 ngày. Mỗi loại cây hợp mùa riêng (xem ở chợ); trái mùa cây vẫn lớn nhưng chậm một nửa và mau khô.</li>
      <li><strong>Chăm cây:</strong> 💧 đất khô dần theo giờ, nhanh hơn vào mùa hạ và ban ngày; đất khô hẳn thì cây gần như ngừng lớn, tưới là đất ẩm lại. 🌿 cỏ và 🐛 sâu làm mất sản lượng lúc thu hoạch. ⭐ là cây đã chín.</li>
      <li><strong>Thu nhiều lứa:</strong> cà chua, dâu tây và dưa hấu thu xong vẫn đứng đó và ra quả lứa sau, đến khi hết lứa thì mới phải trồng lại. Rau, củ, ngô, lúa, bí, hướng dương thu một lần.</li>
      <li><strong>Vườn cây:</strong> đào hố, trồng cây giống (mua ở chợ), tưới khi đất khô. Cây ăn quả lớn mất vài ngày, rồi ra quả mãi, nhanh nhất vào mùa quả của nó; khi có ⭐ thì chạm hoặc kéo qua để rung cây, quả rơi vào kho.</li>
      <li><strong>Câu cá ở sông:</strong> chạm mặt sông để thả câu. Phao rung nhẹ là cá rỉa, chưa giật; phao chìm hẳn và hiện dấu ! thì chạm ngay để giật. Rồi giữ để kéo, thả tay khi dây căng đỏ kẻo đứt. Mỗi lần cá cắn tốn một 🪱 mồi.</li>
      <li><strong>Ao cá:</strong> mua cá giống ở chợ, cho ăn để cá lớn đủ tốc độ, vớt rác để nước sạch. Cá có ⭐ là đã lớn — chạm để vớt.</li>
      <li><strong>Trang trại:</strong> chia khu gà (chuồng gà, ổ rơm), khu vịt riêng (ao nhỏ cho vịt bơi, nhà vịt), chuồng cừu, chuồng bò và lối đi ở giữa; mỗi chuồng có máng riêng và to dần mỗi lần mở rộng. Mua về là gà con, vịt con, cừu non, bê con; chúng ăn từ máng để lớn. Lớn rồi thì ban ngày đẻ trứng, cho len, sữa; đêm (20:00–5:00) chúng ngủ. Chạm sản phẩm trên cỏ (hoặc nút 🧺) để nhặt. Con có biểu tượng bát là đang chờ thức ăn.</li>
      <li><strong>Lò ấp trứng:</strong> xây ở trang trại (cấp 2), đặt trứng gà hoặc trứng vịt từ kho vào. Đảo trứng ít nhất mỗi 12 giờ game, không thì trứng ngừng phát triển; vài ngày cuối thì để yên. Trứng gà nở sau 21 giờ, trứng vịt sau 28 giờ game, rồi đưa con non ra chuồng.</li>
      <li><strong>Xưởng:</strong> trứng vịt thành trứng muối, trứng gà + lúa thành bánh, len thành khăn, sữa thành phô mai — đắt hơn bán thô.</li>
      <li><strong>Bán hàng:</strong> bán ngay tại kho, hoặc chất lên 🚚 xe tải chở lên phố để được giá cao hơn. Mỗi ngày có một món rau và một loại cá được giá +25%.</li>
      <li><strong>Lên cấp:</strong> mọi việc đều cho XP. Cấp cao mở cây, cá, vật nuôi, xưởng và đất mới.</li>
      <li><strong>Học mỗi ngày:</strong> lưu một bài luyện 5 phút để nhận quà học tập trong mục 🎁.</li>
    </ol>
  );
}
