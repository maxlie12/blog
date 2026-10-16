"use client";

import { useEffect, useRef } from "react";
import type { GameState } from "@/lib/farm/engine";
import type { FarmSceneController, FarmView, SceneHit } from "@/lib/farm/scene";

/**
 * Mounts the three.js farm. three.js and the scene builder are imported on demand, so the page
 * only downloads them once the player actually enters the farm.
 */
export default function FarmScene3D({
  game,
  view,
  selectedPlot,
  onHit,
  onUnavailable,
}: {
  game: GameState;
  view: FarmView;
  selectedPlot: number | null;
  onHit: (hit: SceneHit) => void;
  onUnavailable: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<FarmSceneController | null>(null);
  const latestRef = useRef({ game, view, selectedPlot });
  const onHitRef = useRef(onHit);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    onHitRef.current = onHit;
    onUnavailableRef.current = onUnavailable;
  }, [onHit, onUnavailable]);

  useEffect(() => {
    latestRef.current = { game, view, selectedPlot };
    const controller = controllerRef.current;
    if (!controller) return;
    controller.update(game);
    controller.setView(view);
    controller.setSelectedPlot(selectedPlot);
  }, [game, view, selectedPlot]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") ?? probe.getContext("webgl"))) {
      const frame = window.requestAnimationFrame(() => onUnavailableRef.current());
      return () => window.cancelAnimationFrame(frame);
    }
    let cancelled = false;
    import("@/lib/farm/scene")
      .then(({ createFarmScene }) => {
        if (cancelled) return;
        const controller = createFarmScene(mount, (hit) => onHitRef.current(hit));
        const latest = latestRef.current;
        controller.update(latest.game);
        controller.setView(latest.view);
        controller.setSelectedPlot(latest.selectedPlot);
        controllerRef.current = controller;
      })
      .catch(() => {
        if (!cancelled) onUnavailableRef.current();
      });
    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  return <div ref={mountRef} className="fg-scene" />;
}
