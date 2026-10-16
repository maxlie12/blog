"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import * as Farm from "@/lib/farm/engine";
import type { FarmView, SceneHit } from "@/lib/farm/scene";
import FarmScene3D from "./FarmScene3D";

type Tool = "hand" | "seed" | "water" | "weed" | "bug" | "fertilize" | "hoe";
type SheetName = "shop" | "barn" | "gifts" | "seeds" | "help";
type ShopTab = "seeds" | "fish" | "items" | "expand";
type Toast = { id: number; text: string; tone: Farm.Tone };
type Storage = "pending" | "ok" | "unavailable";
export type PracticeDay = { date: string; intensity: 0 | 1 | 2 };

interface State {
  game: Farm.GameState | null;
  toast: Toast | null;
  seq: number;
  saveSeq: number;
  storage: Storage;
}

type Action =
  | { type: "load"; game: Farm.GameState; message: string | null; storage: Storage }
  | { type: "tick"; now: number; seed: number }
  | { type: "act"; run: (game: Farm.GameState) => Farm.ActionResult }
  | { type: "reset"; now: number }
  | { type: "toast"; text: string; tone: Farm.Tone }
  | { type: "dismiss"; id: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return {
        ...state,
        game: action.game,
        storage: action.storage,
        seq: state.seq + 1,
        saveSeq: state.saveSeq + 1,
        toast: action.message ? { id: state.seq + 1, text: action.message, tone: "info" } : state.toast,
      };
    case "tick":
      return state.game ? { ...state, game: Farm.advance(state.game, action.now, action.seed) } : state;
    case "act": {
      if (!state.game) return state;
      const result = action.run(state.game);
      return {
        ...state,
        game: result.game,
        saveSeq: result.ok ? state.saveSeq + 1 : state.saveSeq,
        seq: state.seq + 1,
        toast: { id: state.seq + 1, text: result.message, tone: result.tone },
      };
    }
    case "reset":
      return {
        ...state,
        game: Farm.createGame(action.now),
        saveSeq: state.saveSeq + 1,
        seq: state.seq + 1,
        toast: { id: state.seq + 1, text: "Đã làm lại nông trại từ đầu.", tone: "info" },
      };
    case "toast":
      return { ...state, seq: state.seq + 1, toast: { id: state.seq + 1, text: action.text, tone: action.tone } };
    case "dismiss":
      return state.toast?.id === action.id ? { ...state, toast: null } : state;
  }
}

const TOOLS: { id: Tool; icon: string; label: string; hint: string }[] = [
  { id: "hand", icon: "👋", label: "Tay", hint: "Tự chọn việc phù hợp: cuốc, gieo, chăm hoặc thu hoạch" },
  { id: "seed", icon: "🌱", label: "Gieo", hint: "Gieo hạt đang chọn" },
  { id: "water", icon: "💧", label: "Tưới", hint: "Tưới ô bị khô" },
  { id: "weed", icon: "🌿", label: "Nhổ cỏ", hint: "Nhổ cỏ dại" },
  { id: "bug", icon: "🐛", label: "Bắt sâu", hint: "Bắt sâu hại" },
  { id: "fertilize", icon: "✨", label: "Bón", hint: "Bón phân cho cây lớn nhanh" },
  { id: "hoe", icon: "⛏️", label: "Cuốc", hint: "Cuốc đất cỏ hoặc gốc đã thu hoạch" },
];

const STAGE_LABELS = ["Mới gieo", "Nảy mầm", "Đang lớn", "Đã chín"];
const coinFormat = new Intl.NumberFormat("vi-VN");

function randomSeed() {
  return Math.floor(Math.random() * 4294967296);
}

export default function FarmGame({ practiceDays }: { practiceDays: PracticeDay[] }) {
  const [state, dispatch] = useReducer(reducer, { game: null, toast: null, seq: 0, saveSeq: 0, storage: "pending" });
  const [view, setView] = useState<FarmView>("farm");
  const [tool, setTool] = useState<Tool>("hand");
  const [seed, setSeed] = useState<Farm.CropId>("cabbage");
  const [selectedPlot, setSelectedPlot] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [shopTab, setShopTab] = useState<ShopTab>("seeds");
  const [pendingPlot, setPendingPlot] = useState<number | null>(null);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const { game, toast, storage, saveSeq } = state;

  /* ───────────── load, tick, save ───────────── */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const now = Date.now();
      let raw: string | null = null;
      let available: Storage = "ok";
      try {
        raw = window.localStorage.getItem(Farm.SAVE_KEY);
      } catch {
        available = "unavailable";
      }
      const saved = Farm.parseSave(raw, now);
      if (saved) {
        const advanced = Farm.advance(saved, now, randomSeed());
        dispatch({ type: "load", game: advanced, message: Farm.describeAway(saved, advanced), storage: available });
        return;
      }
      const message = raw
        ? "Bản lưu cũ không đọc được nên nông trại được làm mới."
        : "Chào mừng đến nông trại! Chạm vào ô đất trống để gieo rau cải đầu tiên.";
      dispatch({ type: "load", game: Farm.createGame(now), message, storage: available });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const tick = () => dispatch({ type: "tick", now: Date.now(), seed: randomSeed() });
    const interval = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const gameRef = useRef<Farm.GameState | null>(null);
  const savedAt = useRef({ time: 0, seq: -1 });
  useEffect(() => {
    gameRef.current = game;
    if (!game || storage !== "ok") return;
    const now = Date.now();
    if (savedAt.current.seq === saveSeq && now - savedAt.current.time < 10_000) return;
    try {
      window.localStorage.setItem(Farm.SAVE_KEY, JSON.stringify(game));
      savedAt.current = { time: now, seq: saveSeq };
    } catch {
      // Storage full or blocked: the farm keeps running in memory for this visit.
    }
  }, [game, saveSeq, storage]);

  useEffect(() => {
    if (storage !== "ok") return;
    const persist = () => {
      if (!gameRef.current) return;
      try {
        window.localStorage.setItem(Farm.SAVE_KEY, JSON.stringify(gameRef.current));
      } catch {
        // Ignore: nothing else can be done while the page is closing.
      }
    };
    window.addEventListener("pagehide", persist);
    return () => window.removeEventListener("pagehide", persist);
  }, [storage]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dispatch({ type: "dismiss", id: toast.id }), toast.text.length > 70 ? 4600 : 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setPendingPlot(null);
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, closeSheet]);

  const act = useCallback((run: (current: Farm.GameState) => Farm.ActionResult) => dispatch({ type: "act", run }), []);
  const say = useCallback((text: string, tone: Farm.Tone = "info") => dispatch({ type: "toast", text, tone }), []);

  if (!game) {
    return (
      <section className="fg" aria-label="Game nông trại và ao cá">
        <div className="fg-stage fg-stage--loading"><span>Đang mở cổng nông trại…</span></div>
      </section>
    );
  }

  /* ───────────── derived values (render-pure: "now" is the last tick) ───────────── */
  const now = game.lastTick;
  const today = Farm.dateKeyVN(now);
  const level = Farm.levelProgress(game.xp);
  const practiceToday = practiceDays.find((day) => day.date === today)?.intensity ?? 0;
  const practice = { draft: practiceToday > 0, revision: practiceToday === 2 };
  const dailyReady = game.lastDailyBonus !== today;
  const studyReady = practice.draft && game.lastStudyReward !== today;
  const barnCount =
    Object.values(game.barn.crops).reduce((sum, value) => sum + (value ?? 0), 0) +
    Object.values(game.barn.fish).reduce((sum, value) => sum + (value ?? 0), 0);
  const seedDef = Farm.CROP_MAP[seed];
  const ownedSeeds = Farm.CROPS.filter((crop) => (game.seeds[crop.id] ?? 0) > 0);

  /* ───────────── interactions ───────────── */
  function openShop(tab: ShopTab) {
    setShopTab(tab);
    setSheet("shop");
  }

  function plantInto(index: number, crop: Farm.CropId) {
    if ((game?.seeds[crop] ?? 0) < 1) {
      say(`Hết hạt ${Farm.CROP_MAP[crop].name}. Mua thêm ở chợ nhé.`, "warn");
      openShop("seeds");
      return;
    }
    act((current) => Farm.plant(current, index, crop));
  }

  function needSeedFor(index: number) {
    if (!game) return;
    if ((game.seeds[seed] ?? 0) > 0) {
      plantInto(index, seed);
      return;
    }
    setPendingPlot(index);
    if (ownedSeeds.length === 0) {
      say("Túi hạt đang trống — mua hạt ở chợ trước nhé.", "warn");
      openShop("seeds");
      return;
    }
    setSheet("seeds");
  }

  function smartPlot(index: number) {
    if (!game) return;
    const plot = game.plots[index];
    if (plot.status === "locked") return;
    if (plot.status === "wild" || plot.status === "withered") return act((current) => Farm.hoe(current, index));
    if (plot.status === "tilled") return needSeedFor(index);
    if (Farm.isRipe(plot)) return act((current) => Farm.harvest(current, index));
    if (plot.bugs > 0) return act((current) => Farm.catchBug(current, index));
    if (plot.weeds > 0) return act((current) => Farm.pullWeed(current, index));
    if (plot.thirsty) return act((current) => Farm.water(current, index));
  }

  function actOnPlot(index: number) {
    setSelectedPlot(index);
    switch (tool) {
      case "hand":
        return smartPlot(index);
      case "seed":
        return needSeedFor(index);
      case "water":
        return act((current) => Farm.water(current, index));
      case "weed":
        return act((current) => Farm.pullWeed(current, index));
      case "bug":
        return act((current) => Farm.catchBug(current, index));
      case "fertilize":
        return act((current) => Farm.fertilize(current, index));
      case "hoe":
        return act((current) => Farm.hoe(current, index));
    }
  }

  function actOnFish(id: string) {
    const at = Date.now();
    act((current) => Farm.catchFish(current, id, at));
  }

  function feed() {
    const at = Date.now();
    act((current) => Farm.feedFish(current, at));
  }

  function handleHit(hit: SceneHit) {
    if (hit.kind === "barn") return setSheet("barn");
    if (hit.kind === "shop") return openShop("seeds");
    if (hit.kind === "plot") {
      if (view !== "farm") {
        setView("farm");
        setSelectedPlot(hit.index);
        return;
      }
      return actOnPlot(hit.index);
    }
    if (view !== "pond") {
      setView("pond");
      setSelectedPlot(null);
      return;
    }
    if (hit.kind === "fish") return actOnFish(hit.id);
    if (hit.kind === "trash") return act((current) => Farm.removeTrash(current, hit.id));
  }

  function chooseTool(next: Tool) {
    if (next === "seed" && (tool === "seed" || (game?.seeds[seed] ?? 0) < 1)) {
      setTool("seed");
      setSheet("seeds");
      return;
    }
    setTool(next);
  }

  function chooseSeed(crop: Farm.CropId) {
    setSeed(crop);
    setTool((current) => (current === "hand" ? "hand" : "seed"));
    const target = pendingPlot;
    setSheet(null);
    setPendingPlot(null);
    if (target !== null) plantInto(target, crop);
    else say(`Đã chọn hạt ${Farm.CROP_MAP[crop].emoji} ${Farm.CROP_MAP[crop].name}.`);
  }

  function resetFarm() {
    if (window.confirm("Làm lại nông trại từ đầu? Toàn bộ xu, cây và cá trên trình duyệt này sẽ mất.")) {
      dispatch({ type: "reset", now: Date.now() });
      setSelectedPlot(null);
      setSheet(null);
    }
  }

  const selected = selectedPlot !== null && view === "farm" ? game.plots[selectedPlot] : null;

  return (
    <section className="fg" aria-label="Game nông trại và ao cá">
      <div className="fg-stage" data-view={view}>
        {mode === "3d" ? (
          <FarmScene3D
            game={game}
            view={view}
            selectedPlot={view === "farm" ? selectedPlot : null}
            onHit={handleHit}
            onUnavailable={() => {
              setMode("2d");
              say("Thiết bị không hỗ trợ 3D, chuyển sang bản 2D nhẹ.", "info");
            }}
          />
        ) : (
          <Board2D game={game} view={view} selectedPlot={selectedPlot} onPlot={actOnPlot} onFish={actOnFish} onTrash={(id) => act((current) => Farm.removeTrash(current, id))} />
        )}

        <div className="fg-hud">
          <div className="fg-top">
            <div className="fg-level" title={`${game.xp} XP tổng`}>
              <b aria-label={`Cấp ${level.level}`}>{level.level}</b>
              <div>
                <span>Cấp {level.level}</span>
                <i aria-hidden="true"><em style={{ width: `${Math.round(level.ratio * 100)}%` }} /></i>
                <small>{level.into}/{level.needed} XP</small>
              </div>
            </div>
            <div className="fg-views" role="group" aria-label="Chọn khu vực">
              <button type="button" aria-pressed={view === "farm"} onClick={() => setView("farm")}>🌾 Ruộng</button>
              <button type="button" aria-pressed={view === "pond"} onClick={() => { setView("pond"); setSelectedPlot(null); }}>🐟 Ao cá</button>
            </div>
            <div className="fg-coins" aria-label={`${game.coins} xu`}><span aria-hidden="true">🪙</span>{coinFormat.format(game.coins)}</div>
          </div>

          {toast ? <div key={toast.id} className="fg-toast" data-tone={toast.tone} role="status">{toast.text}</div> : null}

          <div className="fg-side">
            <button type="button" onClick={() => openShop(view === "pond" ? "fish" : "seeds")}><span aria-hidden="true">🏪</span>Chợ</button>
            <button type="button" onClick={() => setSheet("barn")}><span aria-hidden="true">📦</span>Kho{barnCount > 0 ? <b>{barnCount}</b> : null}</button>
            <button type="button" onClick={() => setSheet("gifts")}><span aria-hidden="true">🎁</span>Quà{dailyReady || studyReady ? <b className="fg-dot" aria-label="có quà chưa nhận">!</b> : null}</button>
            <button type="button" onClick={() => setSheet("help")}><span aria-hidden="true">❔</span>Cách chơi</button>
          </div>

          <div className="fg-bottom">
            {view === "farm" && selected && selectedPlot !== null ? (
              <PlotCard
                game={game}
                index={selectedPlot}
                seed={seed}
                onClose={() => setSelectedPlot(null)}
                onAct={(run) => act(run)}
                onPlant={() => needSeedFor(selectedPlot)}
              />
            ) : null}
            {view === "pond" ? (
              <PondCard
                game={game}
                onFeed={feed}
                onCatchAll={() => act((current) => Farm.catchAllMature(current))}
                onClear={() => act((current) => Farm.clearTrash(current))}
                onStock={() => openShop("fish")}
              />
            ) : (
              <div className="fg-tools" role="toolbar" aria-label="Công cụ làm ruộng">
                {TOOLS.map((item) => {
                  const icon = item.id === "seed" ? seedDef.emoji : item.icon;
                  const badge =
                    item.id === "seed" ? game.seeds[seed] ?? 0 : item.id === "fertilize" ? game.items.fertilizer : null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.hint}
                      aria-pressed={tool === item.id}
                      onClick={() => chooseTool(item.id)}
                    >
                      <span aria-hidden="true">{icon}</span>
                      {item.id === "seed" ? seedDef.name : item.label}
                      {badge !== null ? <b>{badge}</b> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {sheet ? (
          <Sheet title={SHEET_TITLES[sheet]} onClose={closeSheet}>
            {sheet === "shop" ? <ShopSheet game={game} tab={shopTab} onTab={setShopTab} onAct={act} /> : null}
            {sheet === "barn" ? <BarnSheet game={game} today={today} onAct={act} /> : null}
            {sheet === "seeds" ? (
              <SeedSheet game={game} current={seed} pending={pendingPlot !== null} onChoose={chooseSeed} onShop={() => openShop("seeds")} />
            ) : null}
            {sheet === "gifts" ? (
              <GiftSheet game={game} today={today} practice={practice} dailyReady={dailyReady} onAct={act} />
            ) : null}
            {sheet === "help" ? <HelpSheet /> : null}
          </Sheet>
        ) : null}
      </div>

      <footer className="fg-foot">
        <p>
          {storage === "unavailable"
            ? "Trình duyệt chặn bộ nhớ cục bộ: nông trại chỉ tồn tại trong lần mở trang này."
            : "Tiến độ lưu trên trình duyệt này, không đồng bộ sang thiết bị khác. Cây và cá vẫn lớn khi bạn đóng trang."}
        </p>
        <div>
          <button type="button" onClick={() => setMode(mode === "3d" ? "2d" : "3d")}>{mode === "3d" ? "Chế độ 2D nhẹ" : "Chế độ 3D"}</button>
          <button type="button" onClick={resetFarm}>Làm lại từ đầu</button>
        </div>
      </footer>
    </section>
  );
}

const SHEET_TITLES: Record<SheetName, string> = {
  shop: "🏪 Chợ làng",
  barn: "📦 Nhà kho",
  gifts: "🎁 Quà hằng ngày",
  seeds: "🌱 Chọn hạt giống",
  help: "❔ Cách chơi",
};

/* ───────────────────────── cards ───────────────────────── */

function PlotCard({
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
  onAct: (run: (game: Farm.GameState) => Farm.ActionResult) => void;
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

function PondCard({
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
  const capacity = Farm.pondCapacity(game);
  return (
    <div className="fg-card fg-card--pond">
      <div className="fg-pond-stats">
        <span>🐟 {game.pond.fish.length}/{capacity} cá</span>
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

/* ───────────────────────── sheets ───────────────────────── */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
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

type ActFn = (run: (game: Farm.GameState) => Farm.ActionResult) => void;

function ShopSheet({ game, tab, onTab, onAct }: { game: Farm.GameState; tab: ShopTab; onTab: (tab: ShopTab) => void; onAct: ActFn }) {
  const level = Farm.levelFromXp(game.xp);
  const full = game.pond.fish.length >= Farm.pondCapacity(game);
  const unlock = Farm.nextPlotUnlock(game);
  const pond = Farm.nextPondUpgrade(game);
  const firstLocked = game.plots.findIndex((plot) => plot.status === "locked");
  const tabs: [ShopTab, string][] = [["seeds", "Hạt giống"], ["fish", "Cá giống"], ["items", "Vật phẩm"], ["expand", "Mở rộng"]];
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
                  <button type="button" disabled={locked || full || game.coins < fish.fryPrice} onClick={() => onAct((current) => Farm.buyFry(current, fish.id))}>
                    {full && !locked ? "Ao đầy" : `${fish.fryPrice} xu`}
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
            return (
              <li key={id}>
                <span className="fg-list__icon" aria-hidden="true">{item.emoji}</span>
                <div>
                  <strong>{item.name} <em>· đang có {game.items[id]}</em></strong>
                  <small>{item.note}</small>
                </div>
                <div className="fg-list__buy">
                  <button type="button" disabled={game.coins < item.price} onClick={() => onAct((current) => Farm.buyItem(current, id, 1))}>{item.price} xu</button>
                  <button type="button" disabled={game.coins < item.price * 5} onClick={() => onAct((current) => Farm.buyItem(current, id, 5))}>×5</button>
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
              {unlock ? (
                <button type="button" disabled={level < unlock.level || game.coins < unlock.cost} onClick={() => onAct((current) => Farm.unlockPlot(current, firstLocked))}>Mở</button>
              ) : null}
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

function BarnSheet({ game, today, onAct }: { game: Farm.GameState; today: string; onAct: ActFn }) {
  const featured = Farm.featuredToday(today);
  const crops = Farm.CROPS.filter((crop) => (game.barn.crops[crop.id] ?? 0) > 0);
  const fishes = Farm.FISHES.filter((fish) => (game.barn.fish[fish.id] ?? 0) > 0);
  const total = Farm.barnValue(game, today);
  const seeds = Farm.CROPS.filter((crop) => (game.seeds[crop.id] ?? 0) > 0);
  return (
    <>
      <p className="fg-featured">
        Giá tốt hôm nay (+25%): {Farm.CROP_MAP[featured.crop].emoji} {Farm.CROP_MAP[featured.crop].name} và {Farm.FISH_MAP[featured.fish].emoji} {Farm.FISH_MAP[featured.fish].name}
      </p>
      {crops.length === 0 && fishes.length === 0 ? <p className="fg-empty">Kho trống. Thu hoạch rau hoặc vớt cá lớn để có hàng bán.</p> : null}
      <ul className="fg-list">
        {crops.map((crop) => {
          const owned = game.barn.crops[crop.id] ?? 0;
          const price = Farm.cropSellPrice(crop.id, today);
          return (
            <li key={crop.id}>
              <span className="fg-list__icon" aria-hidden="true">{crop.emoji}</span>
              <div>
                <strong>{crop.name} <em>× {owned}</em></strong>
                <small>{price} xu mỗi phần{featured.crop === crop.id ? " · ⭐ giá tốt" : ""}</small>
              </div>
              <div className="fg-list__buy">
                <button type="button" onClick={() => onAct((current) => Farm.sellGoods(current, "crop", crop.id, 1, today))}>Bán 1</button>
                <button type="button" onClick={() => onAct((current) => Farm.sellGoods(current, "crop", crop.id, owned, today))}>+{price * owned}</button>
              </div>
            </li>
          );
        })}
        {fishes.map((fish) => {
          const owned = game.barn.fish[fish.id] ?? 0;
          const price = Farm.fishSellPrice(fish.id, today);
          return (
            <li key={fish.id}>
              <span className="fg-list__icon" style={{ background: fish.color }} aria-hidden="true">{fish.emoji}</span>
              <div>
                <strong>{fish.name} <em>× {owned}</em></strong>
                <small>{price} xu mỗi con{featured.fish === fish.id ? " · ⭐ giá tốt" : ""}</small>
              </div>
              <div className="fg-list__buy">
                <button type="button" onClick={() => onAct((current) => Farm.sellGoods(current, "fish", fish.id, 1, today))}>Bán 1</button>
                <button type="button" onClick={() => onAct((current) => Farm.sellGoods(current, "fish", fish.id, owned, today))}>+{price * owned}</button>
              </div>
            </li>
          );
        })}
      </ul>
      {total > 0 ? (
        <button type="button" className="fg-wide" onClick={() => onAct((current) => Farm.sellAll(current, today))}>💰 Bán tất cả · +{coinFormat.format(total)} xu</button>
      ) : null}
      <div className="fg-inventory">
        <p><strong>Túi đồ</strong></p>
        <p>
          {seeds.length ? seeds.map((crop) => `${crop.emoji} ${game.seeds[crop.id]}`).join(" · ") : "Chưa có hạt giống"} · ✨ {game.items.fertilizer} phân bón · 🍞 {game.items.fishFood} cám
        </p>
        <p className="fg-muted">Đã thu hoạch {game.stats.harvested} nông sản · vớt {game.stats.fishCaught} cá · kiếm {coinFormat.format(game.stats.earned)} xu.</p>
      </div>
    </>
  );
}

function SeedSheet({
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

function GiftSheet({
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

function HelpSheet() {
  return (
    <ol className="fg-help">
      <li><strong>Ruộng:</strong> chạm ô đất bằng 👋 Tay để tự làm việc phù hợp — cuốc, gieo, chăm hoặc thu hoạch. Các công cụ bên dưới làm từng việc riêng.</li>
      <li><strong>Chăm cây:</strong> 💧 đất khô làm cây lớn chậm một nửa; 🌿 cỏ và 🐛 sâu làm mất sản lượng lúc thu hoạch. ⭐ là cây đã chín.</li>
      <li><strong>Ao cá:</strong> mua cá giống ở chợ, cho ăn để cá lớn đủ tốc độ, vớt rác để nước sạch. Cá có ⭐ là đã lớn — chạm để vớt.</li>
      <li><strong>Kho & chợ:</strong> bán nông sản và cá trong kho lấy xu, mua hạt mới, mở thêm đất và mở rộng ao. Mỗi ngày có một món được giá +25%.</li>
      <li><strong>Lên cấp:</strong> mọi việc đều cho XP. Cấp cao mở cây, cá và đất mới.</li>
      <li><strong>Học mỗi ngày:</strong> lưu một bài luyện 5 phút để nhận quà học tập trong mục 🎁.</li>
    </ol>
  );
}

/* ───────────────────────── 2D board (no WebGL, or by choice) ───────────────────────── */

function Board2D({
  game,
  view,
  selectedPlot,
  onPlot,
  onFish,
  onTrash,
}: {
  game: Farm.GameState;
  view: FarmView;
  selectedPlot: number | null;
  onPlot: (index: number) => void;
  onFish: (id: string) => void;
  onTrash: (id: string) => void;
}) {
  if (view === "pond") {
    return (
      <div className="fg-board fg-board--pond">
        <div className="fg-board__water">
          {game.pond.fish.length === 0 ? <p>Ao chưa có cá. Mua cá giống ở chợ.</p> : null}
          {game.pond.fish.map((fish) => {
            const def = Farm.FISH_MAP[fish.species];
            const mature = Farm.isFishMature(fish);
            const ratio = Math.min(1, fish.growth / def.growSeconds);
            return (
              <button key={fish.id} type="button" onClick={() => onFish(fish.id)} data-mature={mature || undefined} aria-label={`${def.name}, ${mature ? "đã lớn, chạm để vớt" : `lớn ${Math.round(ratio * 100)}%`}`}>
                <span style={{ fontSize: `${1.2 + ratio}rem` }} aria-hidden="true">{def.emoji}</span>
                <small>{mature ? "⭐ Vớt" : `${Math.round(ratio * 100)}%`}</small>
              </button>
            );
          })}
          {game.pond.trash.map((item) => (
            <button key={item.id} type="button" className="fg-board__trash" onClick={() => onTrash(item.id)} aria-label="Vớt rác">
              {item.kind === "leaf" ? "🍂" : item.kind === "bottle" ? "🧴" : "🥫"}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="fg-board">
      <div className="fg-board__grid">
        {game.plots.map((plot, index) => {
          const def = plot.crop ? Farm.CROP_MAP[plot.crop] : null;
          const ripe = Farm.isRipe(plot);
          const stage = Farm.cropStage(plot);
          const label =
            plot.status === "locked" ? "🔒" : plot.status === "wild" ? "🌾" : plot.status === "withered" ? "🍂" : plot.status === "tilled" ? "＋" : stage < 2 ? "🌱" : def?.emoji;
          const issues = `${plot.thirsty ? "💧" : ""}${plot.weeds ? "🌿" : ""}${plot.bugs ? "🐛" : ""}`;
          const name =
            plot.status === "growing" && def ? `${def.name}, ${STAGE_LABELS[stage]}` : plot.status === "locked" ? "ô chưa mở" : plot.status === "tilled" ? "đất trống" : plot.status === "wild" ? "đất cỏ" : "gốc cũ";
          return (
            <button
              key={index}
              type="button"
              data-status={plot.status}
              data-ripe={ripe || undefined}
              aria-pressed={selectedPlot === index}
              aria-label={`Ô ${index + 1}: ${name}${issues ? ", cần chăm" : ""}`}
              onClick={() => onPlot(index)}
            >
              <span aria-hidden="true" style={{ fontSize: stage === 2 ? "1.35rem" : undefined }}>{label}</span>
              {issues ? <small aria-hidden="true">{issues}</small> : null}
              {ripe ? <b aria-hidden="true">⭐</b> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
