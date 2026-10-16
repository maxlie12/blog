"use client";

import { useEffect, useRef } from "react";
import type { GameState } from "@/lib/farm/engine";
import type { Quality } from "@/lib/farm/quality";
import type { FarmSceneController, FarmView, SceneHit } from "@/lib/farm/scene";

/**
 * Mounts the three.js farm. three.js and the scene builder are imported on demand, so the page
 * only downloads them once the player actually enters the farm. Remount (change `key`) to apply
 * a different quality preset, since antialiasing is fixed when the renderer is created.
 */
export default function FarmScene3D({
  game,
  view,
  selectedPlot,
  quality,
  adaptive,
  onHit,
  onUnavailable,
  onDowngrade,
}: {
  game: GameState;
  view: FarmView;
  selectedPlot: number | null;
  quality: Quality;
  adaptive: boolean;
  onHit: (hit: SceneHit) => void;
  onUnavailable: () => void;
  onDowngrade: (note: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<FarmSceneController | null>(null);
  const latestRef = useRef({ game, view, selectedPlot });
  const settingsRef = useRef({ quality, adaptive });
  const callbacksRef = useRef({ onHit, onUnavailable, onDowngrade });

  useEffect(() => {
    callbacksRef.current = { onHit, onUnavailable, onDowngrade };
  }, [onHit, onUnavailable, onDowngrade]);

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
      const frame = window.requestAnimationFrame(() => callbacksRef.current.onUnavailable());
      return () => window.cancelAnimationFrame(frame);
    }
    let cancelled = false;
    import("@/lib/farm/scene")
      .then(({ createFarmScene }) => {
        if (cancelled) return;
        const controller = createFarmScene(mount, {
          quality: settingsRef.current.quality,
          adaptive: settingsRef.current.adaptive,
          onHit: (hit) => callbacksRef.current.onHit(hit),
          onDowngrade: (note) => callbacksRef.current.onDowngrade(note),
        });
        const latest = latestRef.current;
        controller.update(latest.game);
        controller.setView(latest.view);
        controller.setSelectedPlot(latest.selectedPlot);
        controllerRef.current = controller;
      })
      .catch(() => {
        if (!cancelled) callbacksRef.current.onUnavailable();
      });
    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  return <div ref={mountRef} className="fg-scene" />;
}
