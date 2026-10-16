"use client";

import type { CSSProperties } from "react";
import * as Farm from "@/lib/farm/engine";
import type { FarmView } from "@/lib/farm/scene";
import { STAGE_LABELS } from "./shared";

const SHORT_NAMES: Record<Farm.WorkshopId, string> = { saltery: "Trứng muối", bakery: "Lò bánh", loom: "Dệt len", dairy: "Phô mai" };

/**
 * Lightweight 2D version of the farm: plain DOM, emoji and CSS transforms only, so it runs on
 * any device and costs almost no battery. Every 3D interaction exists here too.
 */
export default function Board2D({
  game,
  view,
  selectedPlot,
  onPlot,
  onFish,
  onTrash,
  onAnimal,
  onDrop,
  onWorkshop,
  onTrough,
  onTruck,
}: {
  game: Farm.GameState;
  view: FarmView;
  selectedPlot: number | null;
  onPlot: (index: number) => void;
  onFish: (id: string) => void;
  onTrash: (id: string) => void;
  onAnimal: (id: string) => void;
  onDrop: (id: string) => void;
  onWorkshop: (id: Farm.WorkshopId) => void;
  onTrough: () => void;
  onTruck: () => void;
}) {
  if (view === "pond") {
    return (
      <div className="fg2 fg2--pond">
        <div className="fg2-pond">
          {game.pond.fish.length === 0 ? <p className="fg2-hint">Ao chưa có cá. Mua cá giống ở chợ.</p> : null}
          {game.pond.fish.map((fish, index) => {
            const def = Farm.FISH_MAP[fish.species];
            const mature = Farm.isFishMature(fish);
            const ratio = Math.min(1, fish.growth / def.growSeconds);
            const seed = Farm.hashString(fish.id);
            const style = {
              "--x": `${18 + (seed % 60)}%`,
              "--y": `${22 + ((seed >>> 8) % 50)}%`,
              "--size": `${1.3 + ratio * 1.1}rem`,
              "--swim": `${7 + (seed % 5)}s`,
              "--delay": `${-(index * 1.7)}s`,
            } as CSSProperties;
            return (
              <button key={fish.id} type="button" className="fg2-fish" style={style} data-mature={mature || undefined} onClick={() => onFish(fish.id)} aria-label={`${def.name}, ${mature ? "đã lớn, chạm để vớt" : `lớn ${Math.round(ratio * 100)}%`}`}>
                <span aria-hidden="true">{def.emoji}</span>
                {mature ? <b aria-hidden="true">⭐</b> : null}
              </button>
            );
          })}
          {game.pond.trash.map((item) => (
            <button
              key={item.id}
              type="button"
              className="fg2-trash"
              style={{ left: `${50 + item.x * 38}%`, top: `${50 + item.z * 34}%` }}
              onClick={() => onTrash(item.id)}
              aria-label="Vớt rác"
            >
              {item.kind === "leaf" ? "🍂" : item.kind === "bottle" ? "🧴" : "🥫"}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === "ranch") {
    const level = Farm.levelFromXp(game.xp);
    return (
      <div className="fg2 fg2--ranch">
        <div className="fg2-pasture">
          <button type="button" className="fg2-trough" onClick={onTrough} aria-label={`Máng ăn, còn ${game.items.feed} phần`}>
            <span aria-hidden="true">🥣</span>
            <small>{game.items.feed}</small>
          </button>
          {game.ranch.animals.map((animal, index) => {
            const def = Farm.ANIMAL_MAP[animal.species];
            const waiting = Farm.animalSecondsLeft(game, animal) === null;
            const seed = Farm.hashString(animal.id);
            const style = {
              "--x": `${14 + (seed % 62)}%`,
              "--y": `${18 + ((seed >>> 8) % 52)}%`,
              "--walk": `${5 + (seed % 4)}s`,
              "--delay": `${-(index * 1.3)}s`,
            } as CSSProperties;
            return (
              <button key={animal.id} type="button" className="fg2-animal" style={style} data-waiting={waiting || undefined} onClick={() => onAnimal(animal.id)} aria-label={`${def.name}${waiting ? ", đang chờ thức ăn" : ""}`}>
                <span aria-hidden="true">{def.emoji}</span>
                {waiting ? <b aria-hidden="true">🥣</b> : null}
              </button>
            );
          })}
          {game.ranch.drops.map((drop) => {
            const def = Farm.PRODUCT_MAP[drop.product];
            return (
              <button
                key={drop.id}
                type="button"
                className="fg2-drop"
                data-product={drop.product}
                style={{ left: `${50 + drop.x * 40}%`, top: `${50 + drop.z * 36}%` }}
                onClick={() => onDrop(drop.id)}
                aria-label={`Nhặt ${def.name}`}
              >
                {def.emoji}
              </button>
            );
          })}
        </div>
        <div className="fg2-yard">
          {Farm.WORKSHOPS.map((def) => {
            const state = game.ranch.workshops[def.id];
            const good = Farm.GOOD_MAP[def.output];
            const label = !state ? (level < def.level ? `🔒 cấp ${def.level}` : `🔨 ${def.buildCost} xu`) : state.ready > 0 ? `⭐ ${state.ready}` : state.progress !== null ? "⚙️ đang làm" : "chờ";
            return (
              <button key={def.id} type="button" className="fg2-shop" aria-label={`${def.name}: ${label}`} style={{ "--roof": def.roof } as CSSProperties} data-built={!!state || undefined} data-ready={(state?.ready ?? 0) > 0 || undefined} onClick={() => onWorkshop(def.id)}>
                <span aria-hidden="true">{good.emoji}</span>
                <strong>{SHORT_NAMES[def.id]}</strong>
                <small>{label}</small>
              </button>
            );
          })}
          <button type="button" className="fg2-truck" data-away={!!game.ranch.truck || undefined} onClick={onTruck}>
            <span aria-hidden="true">🚚</span>
            <small>{game.ranch.truck ? `về sau ${Farm.formatDuration((game.ranch.truck.returnAt - game.lastTick) / 1000)}` : "lên phố"}</small>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fg2 fg2--farm">
      <div className="fg2-field">
        {game.plots.map((plot, index) => {
          const def = plot.crop ? Farm.CROP_MAP[plot.crop] : null;
          const ripe = Farm.isRipe(plot);
          const stage = Farm.cropStage(plot);
          const progress = def ? Math.min(1, plot.growth / def.growSeconds) : 0;
          const label =
            plot.status === "locked" ? "🔒" : plot.status === "wild" ? "🌾" : plot.status === "withered" ? "🍂" : plot.status === "tilled" ? "＋" : stage < 2 ? "🌱" : def?.emoji;
          const name =
            plot.status === "growing" && def ? `${def.name}, ${STAGE_LABELS[stage]}` : plot.status === "locked" ? "ô chưa mở" : plot.status === "tilled" ? "đất trống" : plot.status === "wild" ? "đất cỏ" : "gốc cũ";
          const issues = `${plot.thirsty ? "💧" : ""}${plot.weeds ? "🌿" : ""}${plot.bugs ? "🐛" : ""}`;
          return (
            <button
              key={index}
              type="button"
              className="fg2-plot"
              data-status={plot.status}
              data-stage={plot.status === "growing" ? stage : undefined}
              data-thirsty={plot.thirsty || undefined}
              data-ripe={ripe || undefined}
              aria-pressed={selectedPlot === index}
              aria-label={`Ô ${index + 1}: ${name}${issues ? ", cần chăm" : ""}`}
              onClick={() => onPlot(index)}
            >
              <span aria-hidden="true">{label}</span>
              {issues ? <small aria-hidden="true">{issues}</small> : null}
              {plot.status === "growing" && !ripe ? <i aria-hidden="true"><em style={{ width: `${Math.round(progress * 100)}%` }} /></i> : null}
              {ripe ? <b aria-hidden="true">⭐</b> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
