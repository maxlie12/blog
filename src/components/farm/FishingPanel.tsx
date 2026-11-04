"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import * as Farm from "@/lib/farm/engine";
import { BITE_WINDOW, RED_LINE, TERMINAL, castLine, idleFishing, isNibbling, stepFishing, type FishingPhase, type FishingState } from "@/lib/farm/fishing";
import type { FishingLink } from "@/lib/farm/scene";

export type FishingOutcome = Extract<FishingPhase, "caught" | "spooked" | "late" | "snapped" | "slack">;

function catchName(state: FishingState) {
  if (state.catch === "boot") return "👢 chiếc ủng cũ";
  if (!state.catch) return "";
  const def = Farm.WILD_FISH_MAP[state.catch];
  return `${def.emoji} ${def.name} ${Farm.formatWeight(state.weight)}`;
}

function status(state: FishingState): string {
  switch (state.phase) {
    case "ready":
      return "Chạm mặt sông để thả câu, hoặc bấm Thả câu.";
    case "waiting":
      return isNibbling(state) ? "Phao rung… cá đang rỉa mồi, chưa giật!" : "Đang chờ cá cắn câu…";
    case "bite":
      return "Cá cắn câu! Giật ngay!";
    case "reeling":
      return state.tension > RED_LINE ? "Dây căng quá! Thả tay ra!" : "Giữ để kéo cá vào. Dây đỏ thì thả tay.";
    case "caught":
      return `Câu được ${catchName(state)}!`;
    case "spooked":
      return "Giật sớm quá, cá sợ bỏ đi. Thả câu lại nhé.";
    case "late":
      return "Chậm mất rồi, cá ăn mồi bỏ chạy.";
    case "snapped":
      return "Đứt dây! Lần sau thả tay khi dây đỏ.";
    case "slack":
      return "Dây chùng lâu quá, cá thoát mất.";
  }
}

/**
 * Runs the fishing round at the river: steps the pure state machine every frame from the shared
 * input (presses on the water in the 3D scene, on the 2D river, or on this panel's button) and
 * reports each finished round so the game can record the catch or the lost bait.
 */
export default function FishingPanel({
  link,
  xp,
  bait,
  showWater,
  onPress,
  onRelease,
  onOutcome,
  onNoBait,
  onShop,
}: {
  link: FishingLink;
  xp: number;
  bait: number;
  /** The 2D board has no 3D float, so the panel draws a small one. */
  showWater: boolean;
  /** The panel's own button: a press (cast, strike or reel) and its release. */
  onPress: () => void;
  onRelease: () => void;
  onOutcome: (outcome: FishingOutcome, state: FishingState) => void;
  onNoBait: () => void;
  onShop: () => void;
}) {
  const [state, setState] = useState<FishingState>(() => link.state.current);
  const latest = useRef({ xp, bait, onOutcome, onNoBait });

  useEffect(() => {
    latest.current = { xp, bait, onOutcome, onNoBait };
  }, [xp, bait, onOutcome, onNoBait]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frame = window.requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const input = link.input.current;
      let current = link.state.current;
      const canCast = current.phase === "ready" || (TERMINAL.includes(current.phase) && current.t > 0.4);
      if (canCast && input.tapped) {
        input.tapped = false;
        if (latest.current.bait < 1) latest.current.onNoBait();
        else current = castLine(input.castAt ?? [Math.random() - 0.5, 0.5 + Math.random() * 0.35], latest.current.xp, Math.floor(Math.random() * 4294967296));
      }
      const before = current.phase;
      current = stepFishing(current, dt, { holding: input.holding, tapped: input.tapped });
      input.tapped = false;
      input.castAt = null;
      if (current.phase !== before && TERMINAL.includes(current.phase)) latest.current.onOutcome(current.phase as FishingOutcome, current);
      link.state.current = current;
      setState(current);
    };
    frame = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frame);
      // Walking away mid-fight lets the fish go with the bait; an unbitten line is just reeled in.
      const current = link.state.current;
      if (current.phase === "bite" || current.phase === "reeling") latest.current.onOutcome("slack", current);
      link.state.current = idleFishing();
      link.input.current = { holding: false, tapped: false, castAt: null };
    };
  }, [link]);

  const press = onPress;
  const release = onRelease;
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    press();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) press();
  };
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    release();
  };

  const phase = state.phase;
  const label = phase === "reeling" ? "Giữ để kéo" : phase === "bite" ? "Giật!" : phase === "waiting" ? "Giật" : "🎣 Thả câu";
  const red = phase === "reeling" && state.tension > RED_LINE;
  const floatState = phase === "bite" ? "bite" : isNibbling(state) ? "nibble" : phase === "waiting" ? "wait" : phase === "reeling" ? "reel" : "idle";

  return (
    <div className="fg-card fg-card--wide fg-fish" data-phase={phase}>
      <p className="fg-fish__status" role="status">{status(state)}</p>
      {showWater ? (
        <div className="fg-fish__water" aria-hidden="true">
          <span className="fg-fish__angler">🧑‍🌾</span>
          <span className="fg-fish__float" data-state={floatState} style={{ left: `${phase === "reeling" ? 14 + state.distance * 70 : 70}%` }}>
            {phase === "ready" || TERMINAL.includes(phase) ? "" : phase === "bite" ? "❗" : "🔴"}
          </span>
        </div>
      ) : null}
      {phase === "reeling" ? (
        <div className="fg-fish__meters">
          <label>
            <span>Độ căng dây</span>
            <span className="fg-meter" data-red={red || undefined} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.tension * 100)}>
              <i style={{ left: `${RED_LINE * 100}%` }} />
              <em style={{ width: `${Math.min(100, state.tension * 100)}%` }} />
            </span>
          </label>
          <label>
            <span>Còn {Math.round(state.distance * 100)}% dây</span>
            <span className="fg-meter fg-meter--line" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((1 - state.distance) * 100)}>
              <em style={{ width: `${Math.round((1 - state.distance) * 100)}%` }} />
            </span>
          </label>
        </div>
      ) : null}
      {phase === "bite" ? (
        <span className="fg-meter fg-meter--bite" aria-hidden="true"><em style={{ width: `${Math.max(0, 100 - (state.t / BITE_WINDOW) * 100)}%` }} /></span>
      ) : null}
      <div className="fg-card__actions">
        <button
          type="button"
          className="fg-fish__main"
          data-alert={phase === "bite" || red || undefined}
          onPointerDown={onPointerDown}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={release}
        >
          {label}
        </button>
        <span className="fg-fish__bait">🪱 {bait} mồi</span>
        <button type="button" onClick={onShop}>Mua mồi</button>
      </div>
    </div>
  );
}
