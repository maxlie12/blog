"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import * as Farm from "@/lib/farm/engine";
import {
  QUALITY_LABELS,
  detectQuality,
  readQualityChoice,
  saveQualityChoice,
  type GraphicsChoice,
  type Quality,
} from "@/lib/farm/quality";
import type { FarmView, SceneHit } from "@/lib/farm/scene";
import Board2D from "./Board2D";
import { PlotCard, PondCard, RanchCard } from "./cards";
import FarmScene3D from "./FarmScene3D";
import { SHEET_TITLES, coinFormat, type ShopTab, type SheetName } from "./shared";
import { BarnSheet, GiftSheet, HelpSheet, MillSheet, SeedSheet, Sheet, ShopSheet, TruckSheet, WorkshopSheet } from "./sheets";

type Tool = "hand" | "seed" | "water" | "weed" | "bug" | "fertilize" | "hoe";
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
    case "tick": {
      if (!state.game) return state;
      const trip = state.game.ranch.truck;
      const game = Farm.advance(state.game, action.now, action.seed);
      if (trip && !game.ranch.truck) {
        return {
          ...state,
          game,
          saveSeq: state.saveSeq + 1,
          seq: state.seq + 1,
          toast: { id: state.seq + 1, text: `🚚 Xe tải đã về: +${trip.value} xu từ ${trip.items} món bán ở phố.`, tone: "good" },
        };
      }
      return { ...state, game };
    }
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

const VIEWS: { id: FarmView; label: string }[] = [
  { id: "farm", label: "🌾 Ruộng" },
  { id: "pond", label: "🐟 Ao cá" },
  { id: "ranch", label: "🐔 Trại" },
];

const HIT_VIEW: Record<SceneHit["kind"], FarmView | null> = {
  plot: "farm",
  fish: "pond",
  trash: "pond",
  pond: "pond",
  barn: null,
  shop: null,
  animal: "ranch",
  drop: "ranch",
  workshop: "ranch",
  trough: "ranch",
  truck: "ranch",
};

const GRAPHICS_OPTIONS: GraphicsChoice[] = ["auto", "high", "medium", "low", "2d"];

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
  const [graphics, setGraphics] = useState<{ choice: GraphicsChoice; detected: Quality } | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const { game, toast, storage, saveSeq } = state;

  /* ───────────── load, tick, save ───────────── */
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setGraphics({ choice: readQualityChoice(), detected: detectQuality() });
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
  const onUnavailable = useCallback(() => {
    setWebglFailed(true);
    dispatch({ type: "toast", text: "Thiết bị không hỗ trợ 3D, chuyển sang bản 2D.", tone: "info" });
  }, []);
  const onDowngrade = useCallback((note: string) => dispatch({ type: "toast", text: `⚙️ ${note}`, tone: "info" }), []);

  if (!game || !graphics) {
    return (
      <section className="fg" aria-label="Game nông trại, ao cá và trang trại">
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
  const barnCount = Farm.barnEntries(game, today).reduce((sum, entry) => sum + entry.owned, 0);
  const seedDef = Farm.CROP_MAP[seed];
  const ownedSeeds = Farm.CROPS.filter((crop) => (game.seeds[crop.id] ?? 0) > 0);
  const mode: "3d" | "2d" = webglFailed || graphics.choice === "2d" ? "2d" : "3d";
  const quality: Quality = graphics.choice === "auto" || graphics.choice === "2d" ? graphics.detected : graphics.choice;

  /* ───────────── interactions ───────────── */
  function openShop(tab: ShopTab) {
    setShopTab(tab);
    setSheet("shop");
  }

  function changeView(next: FarmView) {
    setView(next);
    if (next !== "farm") setSelectedPlot(null);
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

  function describeAnimal(id: string) {
    if (!game) return;
    const animal = game.ranch.animals.find((item) => item.id === id);
    if (!animal) return;
    const def = Farm.ANIMAL_MAP[animal.species];
    const product = Farm.PRODUCT_MAP[def.product];
    const left = Farm.animalSecondsLeft(game, animal);
    if (left === null) {
      const full = game.ranch.drops.length >= Farm.MAX_DROPS;
      say(full ? `${def.emoji} ${def.name}: bãi cỏ đầy sản phẩm — nhặt bớt để vật nuôi tiếp tục.` : `${def.emoji} ${def.name} đang chờ thức ăn. Xay nông sản hoặc mua ở chợ.`, "warn");
      if (!full) setSheet("mill");
      return;
    }
    say(`${def.emoji} ${def.name} · ${product.emoji} tiếp theo sau ${Farm.formatDuration(left)}.`);
  }

  function actOnWorkshop(id: Farm.WorkshopId) {
    if (!game) return;
    const state = game.ranch.workshops[id];
    if (state && state.ready > 0) return act((current) => Farm.collectWorkshop(current, id));
    if (state && state.progress === null && Farm.canStartWorkshop(game, id)) return act((current) => Farm.startWorkshop(current, id));
    if (state && state.progress !== null) {
      const def = Farm.WORKSHOP_MAP[id];
      return say(`${def.name} đang làm · xong sau ${Farm.formatDuration(def.seconds - state.progress)}.`);
    }
    setSheet("workshops");
  }

  function handleHit(hit: SceneHit) {
    if (hit.kind === "barn") return setSheet("barn");
    if (hit.kind === "shop") return openShop(view === "pond" ? "fish" : view === "ranch" ? "animals" : "seeds");
    const target = HIT_VIEW[hit.kind];
    if (target && target !== view) {
      changeView(target);
      if (hit.kind === "plot") setSelectedPlot(hit.index);
      return;
    }
    switch (hit.kind) {
      case "plot":
        return actOnPlot(hit.index);
      case "fish":
        return actOnFish(hit.id);
      case "trash":
        return act((current) => Farm.removeTrash(current, hit.id));
      case "animal":
        return describeAnimal(hit.id);
      case "drop":
        return act((current) => Farm.collectDrop(current, hit.id));
      case "workshop":
        return actOnWorkshop(hit.id);
      case "trough":
        return setSheet("mill");
      case "truck":
        return setSheet("truck");
    }
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

  function chooseGraphics(choice: GraphicsChoice) {
    saveQualityChoice(choice);
    setGraphics((current) => (current ? { ...current, choice } : current));
    if (choice !== "2d") setWebglFailed(false);
  }

  function resetFarm() {
    if (window.confirm("Làm lại nông trại từ đầu? Toàn bộ xu, cây, cá và vật nuôi trên trình duyệt này sẽ mất.")) {
      dispatch({ type: "reset", now: Date.now() });
      setSelectedPlot(null);
      setSheet(null);
    }
  }

  const selected = selectedPlot !== null && view === "farm" ? game.plots[selectedPlot] : null;

  return (
    <section className="fg" aria-label="Game nông trại, ao cá và trang trại">
      <div className="fg-stage" data-view={view} data-mode={mode}>
        {mode === "3d" ? (
          <FarmScene3D
            key={quality}
            game={game}
            view={view}
            selectedPlot={view === "farm" ? selectedPlot : null}
            quality={quality}
            adaptive={graphics.choice === "auto"}
            onHit={handleHit}
            onUnavailable={onUnavailable}
            onDowngrade={onDowngrade}
          />
        ) : (
          <Board2D
            game={game}
            view={view}
            selectedPlot={selectedPlot}
            onPlot={actOnPlot}
            onFish={actOnFish}
            onTrash={(id) => act((current) => Farm.removeTrash(current, id))}
            onAnimal={describeAnimal}
            onDrop={(id) => act((current) => Farm.collectDrop(current, id))}
            onWorkshop={actOnWorkshop}
            onTrough={() => setSheet("mill")}
            onTruck={() => setSheet("truck")}
          />
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
              {VIEWS.map((item) => (
                <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => changeView(item.id)}>{item.label}</button>
              ))}
            </div>
            <div className="fg-coins" aria-label={`${game.coins} xu`}><span aria-hidden="true">🪙</span>{coinFormat.format(game.coins)}</div>
          </div>

          {toast ? <div key={toast.id} className="fg-toast" data-tone={toast.tone} role="status">{toast.text}</div> : null}

          <div className="fg-side">
            <button type="button" onClick={() => openShop(view === "pond" ? "fish" : view === "ranch" ? "animals" : "seeds")}><span aria-hidden="true">🏪</span>Chợ</button>
            <button type="button" onClick={() => setSheet("barn")}><span aria-hidden="true">📦</span>Kho{barnCount > 0 ? <b>{barnCount}</b> : null}</button>
            <button type="button" onClick={() => setSheet("gifts")}><span aria-hidden="true">🎁</span>Quà{dailyReady || studyReady ? <b className="fg-dot" aria-label="có quà chưa nhận">!</b> : null}</button>
            <button type="button" onClick={() => setSheet("help")}><span aria-hidden="true">❔</span>Cách chơi</button>
          </div>

          <div className="fg-bottom">
            {view === "farm" && selected && selectedPlot !== null ? (
              <PlotCard game={game} index={selectedPlot} seed={seed} onClose={() => setSelectedPlot(null)} onAct={act} onPlant={() => needSeedFor(selectedPlot)} />
            ) : null}
            {view === "pond" ? (
              <PondCard
                game={game}
                onFeed={feed}
                onCatchAll={() => act((current) => Farm.catchAllMature(current))}
                onClear={() => act((current) => Farm.clearTrash(current))}
                onStock={() => openShop("fish")}
              />
            ) : null}
            {view === "ranch" ? (
              <RanchCard
                game={game}
                onCollect={() => act((current) => Farm.collectAllDrops(current))}
                onMill={() => setSheet("mill")}
                onWorkshops={() => setSheet("workshops")}
                onTruck={() => setSheet("truck")}
                onBuy={() => openShop("animals")}
              />
            ) : null}
            {view === "farm" ? (
              <div className="fg-tools" role="toolbar" aria-label="Công cụ làm ruộng">
                {TOOLS.map((item) => {
                  const icon = item.id === "seed" ? seedDef.emoji : item.icon;
                  const badge = item.id === "seed" ? game.seeds[seed] ?? 0 : item.id === "fertilize" ? game.items.fertilizer : null;
                  return (
                    <button key={item.id} type="button" title={item.hint} aria-pressed={tool === item.id} onClick={() => chooseTool(item.id)}>
                      <span aria-hidden="true">{icon}</span>
                      {item.id === "seed" ? seedDef.name : item.label}
                      {badge !== null ? <b>{badge}</b> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {sheet ? (
          <Sheet title={SHEET_TITLES[sheet]} onClose={closeSheet}>
            {sheet === "shop" ? <ShopSheet game={game} tab={shopTab} onTab={setShopTab} onAct={act} /> : null}
            {sheet === "barn" ? <BarnSheet game={game} today={today} onAct={act} onTruck={() => setSheet("truck")} /> : null}
            {sheet === "seeds" ? <SeedSheet game={game} current={seed} pending={pendingPlot !== null} onChoose={chooseSeed} onShop={() => openShop("seeds")} /> : null}
            {sheet === "gifts" ? <GiftSheet game={game} today={today} practice={practice} dailyReady={dailyReady} onAct={act} /> : null}
            {sheet === "mill" ? <MillSheet game={game} onAct={act} onShop={() => openShop("items")} /> : null}
            {sheet === "workshops" ? <WorkshopSheet game={game} onAct={act} /> : null}
            {sheet === "truck" ? <TruckSheet game={game} today={today} onAct={act} /> : null}
            {sheet === "help" ? <HelpSheet /> : null}
          </Sheet>
        ) : null}
      </div>

      <footer className="fg-foot">
        <p>
          {storage === "unavailable"
            ? "Trình duyệt chặn bộ nhớ cục bộ: nông trại chỉ tồn tại trong lần mở trang này."
            : "Tiến độ lưu trên trình duyệt này, không đồng bộ sang thiết bị khác. Cây, cá, vật nuôi và xe tải vẫn chạy khi bạn đóng trang."}
        </p>
        <div>
          <label className="fg-graphics">
            <span>Đồ họa</span>
            <select value={graphics.choice} onChange={(event) => chooseGraphics(event.target.value as GraphicsChoice)}>
              {GRAPHICS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "auto" ? `${QUALITY_LABELS.auto} (${QUALITY_LABELS[graphics.detected]})` : QUALITY_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={resetFarm}>Làm lại từ đầu</button>
        </div>
      </footer>
    </section>
  );
}
