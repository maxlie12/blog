"use client";

import type { ReactNode } from "react";
import * as Farm from "@/lib/farm/engine";
import { STAGE_LABELS, type ActFn } from "./shared";

export function PlotCard({
  game,
  index,
  seed,
  onClose,
  onAct,
  onPlant,
}: {
  game: Farm.GameState;
  index: number;
  seed: Farm.CropId;
  onClose: () => void;
  onAct: ActFn;
  onPlant: () => void;
}) {
  const plot = game.plots[index];
  const level = Farm.levelFromXp(game.xp);
  let title = "";
  let detail: ReactNode = null;
  const buttons: ReactNode[] = [];

  if (plot.status === "locked") {
    const unlock = Farm.nextPlotUnlock(game);
    title = "🔒 Ô đất chưa mở";
    detail = unlock ? `Mở với ${unlock.cost} xu · cần cấp ${unlock.level}.` : "Đã mở hết đất.";
    if (unlock) {
      buttons.push(
        <button key="unlock" type="button" disabled={level < unlock.level || game.coins < unlock.cost} onClick={() => onAct((current) => Farm.unlockPlot(current, index))}>
          Mở ô · {unlock.cost} xu
        </button>,
      );
    }
  } else if (plot.status === "wild" || plot.status === "withered") {
    title = plot.status === "wild" ? "🌾 Đất cỏ dại" : "🍂 Gốc cây cũ";
    detail = "Cuốc đất để trồng vụ mới.";
    buttons.push(<button key="hoe" type="button" onClick={() => onAct((current) => Farm.hoe(current, index))}>⛏️ Cuốc đất</button>);
  } else if (plot.status === "tilled") {
    title = "🟫 Đất trống";
    detail = `Đang chọn hạt ${Farm.CROP_MAP[seed].emoji} ${Farm.CROP_MAP[seed].name} (còn ${game.seeds[seed] ?? 0}).`;
    buttons.push(<button key="plant" type="button" onClick={onPlant}>🌱 Gieo hạt</button>);
  } else if (plot.crop) {
    const def = Farm.CROP_MAP[plot.crop];
    const ripe = Farm.isRipe(plot);
    const harvest = Farm.harvestYield(plot);
    const progress = Math.min(1, plot.growth / def.growSeconds);
    title = `${def.emoji} ${def.name} · ${STAGE_LABELS[Farm.cropStage(plot)]}`;
    const issues = [plot.thirsty ? "khô đất" : null, plot.weeds ? `${plot.weeds} cụm cỏ` : null, plot.bugs ? `${plot.bugs} con sâu` : null].filter(Boolean);
    detail = (
      <>
        <span className="fg-progress" aria-hidden="true"><em style={{ width: `${Math.round(progress * 100)}%` }} /></span>
        {ripe ? `Thu được ${harvest.amount} ${def.emoji}${harvest.lost ? ` (mất ${harvest.lost})` : ""}.` : `Chín sau ~${Farm.formatDuration(Farm.plotSecondsLeft(plot))}.`}
        {issues.length ? ` Cần chăm: ${issues.join(", ")}.` : ""}
      </>
    );
    if (ripe) buttons.push(<button key="harvest" type="button" onClick={() => onAct((current) => Farm.harvest(current, index))}>🧺 Thu hoạch</button>);
    if (plot.thirsty) buttons.push(<button key="water" type="button" onClick={() => onAct((current) => Farm.water(current, index))}>💧 Tưới</button>);
    if (plot.weeds) buttons.push(<button key="weed" type="button" onClick={() => onAct((current) => Farm.pullWeed(current, index))}>🌿 Nhổ cỏ</button>);
    if (plot.bugs) buttons.push(<button key="bug" type="button" onClick={() => onAct((current) => Farm.catchBug(current, index))}>🐛 Bắt sâu</button>);
    if (!ripe && !plot.fertilized) {
      buttons.push(
        <button key="fert" type="button" disabled={game.items.fertilizer < 1} onClick={() => onAct((current) => Farm.fertilize(current, index))}>
          ✨ Bón phân ({game.items.fertilizer})
        </button>,
      );
    }
  }

  return (
    <div className="fg-card" aria-live="polite">
      <div className="fg-card__head">
        <strong>{title}</strong>
        <button type="button" className="fg-close" aria-label="Đóng thông tin ô đất" onClick={onClose}>×</button>
      </div>
      <p>{detail}</p>
      {buttons.length ? <div className="fg-card__actions">{buttons}</div> : null}
    </div>
  );
}

export function PondCard({
  game,
  onFeed,
  onCatchAll,
  onClear,
  onStock,
}: {
  game: Farm.GameState;
  onFeed: () => void;
  onCatchAll: () => void;
  onClear: () => void;
  onStock: () => void;
}) {
  const now = game.lastTick;
  const fed = game.pond.fedUntil > now;
  const mature = game.pond.fish.filter(Farm.isFishMature).length;
  const quality = Math.round(Farm.waterQuality(game.pond.trash.length) * 100);
  return (
    <div className="fg-card fg-card--wide">
      <div className="fg-stats">
        <span>🐟 {game.pond.fish.length}/{Farm.pondCapacity(game)} cá</span>
        <span>{fed ? `🍞 No · ${Farm.formatDuration((game.pond.fedUntil - now) / 1000)}` : "😮 Cá đang đói"}</span>
        <span>💧 Nước {quality}%</span>
        {mature ? <span>⭐ {mature} con đã lớn</span> : null}
      </div>
      <div className="fg-card__actions">
        <button type="button" onClick={onFeed} disabled={game.items.fishFood < 1 || game.pond.fish.length === 0}>🍞 Cho ăn ({game.items.fishFood})</button>
        <button type="button" onClick={onCatchAll} disabled={mature === 0}>🎣 Vớt cá lớn</button>
        <button type="button" onClick={onClear} disabled={game.pond.trash.length === 0}>🧹 Vớt rác ({game.pond.trash.length})</button>
        <button type="button" onClick={onStock}>🐣 Thả cá</button>
      </div>
    </div>
  );
}

export function RanchCard({
  game,
  onCollect,
  onMill,
  onWorkshops,
  onTruck,
  onBuy,
}: {
  game: Farm.GameState;
  onCollect: () => void;
  onMill: () => void;
  onWorkshops: () => void;
  onTruck: () => void;
  onBuy: () => void;
}) {
  const drops = game.ranch.drops.length;
  const waiting = game.ranch.animals.filter((animal) => Farm.animalSecondsLeft(game, animal) === null).length;
  const ready = Object.values(game.ranch.workshops).reduce((sum, item) => sum + (item?.ready ?? 0), 0);
  const truck = game.ranch.truck;
  return (
    <div className="fg-card fg-card--wide">
      <div className="fg-stats">
        <span>🐔 {game.ranch.animals.length}/{Farm.ranchCapacity(game)} con</span>
        <span>🥣 Máng: {game.items.feed} phần</span>
        {waiting ? <span className="fg-warn">⚠️ {waiting} con chờ ăn</span> : null}
        {ready ? <span>⭐ {ready} thành phẩm</span> : null}
        <span>{truck ? `🚚 Về sau ${Farm.formatDuration((truck.returnAt - game.lastTick) / 1000)}` : "🚚 Xe ở trại"}</span>
      </div>
      <div className="fg-card__actions">
        <button type="button" onClick={onCollect} disabled={drops === 0}>🧺 Nhặt ({drops})</button>
        <button type="button" onClick={onMill}>🥣 Thức ăn</button>
        <button type="button" onClick={onWorkshops}>🏭 Xưởng</button>
        <button type="button" onClick={onTruck}>🚚 Lên phố</button>
        <button type="button" onClick={onBuy}>🐣 Mua con</button>
      </div>
    </div>
  );
}
