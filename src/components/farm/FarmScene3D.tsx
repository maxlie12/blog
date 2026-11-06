"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { GameState } from "@/lib/farm/engine";
import type { Quality } from "@/lib/farm/quality";
import type { FarmSceneController, FarmView, FishingLink, SceneHit, SceneTool, ZoomState } from "@/lib/farm/scene";

/**
 * Tells the scene how much of the canvas the game's top bar and bottom bar or card cover, so a
 * phone frames each area in the part left open. Measured when the area or the screen size
 * changes, not when a card opens, so the view keeps still under the player's tap.
 */
function measureCover(mount: HTMLElement, controller: FarmSceneController) {
  const stage = mount.parentElement;
  const top = stage?.querySelector<HTMLElement>(".fg-top");
  const bottom = stage?.querySelector<HTMLElement>(".fg-bottom");
  const hud = bottom?.offsetParent;
  const covered = bottom && hud instanceof HTMLElement && bottom.offsetHeight > 0 ? hud.clientHeight - bottom.offsetTop : 0;
  controller.setCover(top ? top.offsetTop + top.offsetHeight : 0, covered);
}

/**
 * Mounts the three.js farm. three.js and the scene builder are imported on demand, so the page
 * only downloads them once the player actually enters the farm. Remount (change `key`) to apply
 * a different quality preset, since antialiasing is fixed when the renderer is created.
 * Zoom buttons sit at the left edge; with one focused, the arrow keys look around.
 */
export default function FarmScene3D({
  game,
  view,
  selectedPlot,
  tool,
  fishing,
  quality,
  adaptive,
  onHit,
  onUnavailable,
  onDowngrade,
}: {
  game: GameState;
  view: FarmView;
  selectedPlot: number | null;
  tool: SceneTool;
  /** Shared with the fishing panel; read once when the scene is made. */
  fishing: FishingLink;
  quality: Quality;
  adaptive: boolean;
  onHit: (hit: SceneHit) => void;
  onUnavailable: () => void;
  onDowngrade: (note: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<FarmSceneController | null>(null);
  const latestRef = useRef({ game, view, selectedPlot, tool });
  const settingsRef = useRef({ quality, adaptive, fishing });
  const callbacksRef = useRef({ onHit, onUnavailable, onDowngrade });
  const [zoomState, setZoomState] = useState<ZoomState>({ atMin: false, atMax: false, moved: false });

  useEffect(() => {
    callbacksRef.current = { onHit, onUnavailable, onDowngrade };
  }, [onHit, onUnavailable, onDowngrade]);

  useEffect(() => {
    latestRef.current = { game, view, selectedPlot, tool };
    const controller = controllerRef.current;
    if (!controller) return;
    controller.update(game);
    controller.setView(view);
    controller.setSelectedPlot(selectedPlot);
    controller.setTool(tool);
  }, [game, view, selectedPlot, tool]);

  useEffect(() => {
    const mount = mountRef.current;
    if (mount && controllerRef.current) measureCover(mount, controllerRef.current);
  }, [view]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl"))) {
      const frame = window.requestAnimationFrame(() => callbacksRef.current.onUnavailable());
      return () => window.cancelAnimationFrame(frame);
    }
    let cancelled = false;
    const resize = new ResizeObserver(() => {
      if (controllerRef.current) measureCover(mount, controllerRef.current);
    });
    import("@/lib/farm/scene")
      .then(({ createFarmScene }) => {
        if (cancelled) return;
        const controller = createFarmScene(mount, {
          quality: settingsRef.current.quality,
          adaptive: settingsRef.current.adaptive,
          onHit: (hit) => callbacksRef.current.onHit(hit),
          onDowngrade: (note) => callbacksRef.current.onDowngrade(note),
          onZoom: (state) => {
            if (!cancelled) setZoomState(state);
          },
          fishing: settingsRef.current.fishing,
        });
        const latest = latestRef.current;
        controller.update(latest.game);
        controller.setView(latest.view);
        controller.setSelectedPlot(latest.selectedPlot);
        controller.setTool(latest.tool);
        controllerRef.current = controller;
        measureCover(mount, controller);
        resize.observe(mount);
      })
      .catch(() => {
        if (!cancelled) callbacksRef.current.onUnavailable();
      });
    return () => {
      cancelled = true;
      resize.disconnect();
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  const panKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.12], ArrowDown: [0, -0.12] }[event.key];
    if (!step) return;
    event.preventDefault();
    controllerRef.current?.panBy(step[0], step[1]);
  };

  return (
    <>
      <div ref={mountRef} className="fg-scene" />
      <div className="fg-zoom" role="group" aria-label="Phóng to, thu nhỏ khung nhìn (mũi tên để nhìn quanh)">
        <button type="button" aria-label="Phóng to" title="Phóng to (chụm hai ngón hoặc Ctrl + cuộn)" disabled={zoomState.atMax} onClick={() => controllerRef.current?.zoomBy(1.4)} onKeyDown={panKeys}>
          <span aria-hidden="true">+</span>
        </button>
        <button type="button" aria-label="Thu nhỏ" title="Thu nhỏ" disabled={zoomState.atMin} onClick={() => controllerRef.current?.zoomBy(1 / 1.4)} onKeyDown={panKeys}>
          <span aria-hidden="true">−</span>
        </button>
        <button type="button" aria-label="Về khung nhìn ban đầu" title="Về khung nhìn ban đầu" disabled={!zoomState.moved} onClick={() => controllerRef.current?.resetZoom()} onKeyDown={panKeys}>
          <span aria-hidden="true">⤢</span>
        </button>
      </div>
    </>
  );
}
