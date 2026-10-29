"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ChinesePractice } from "@/lib/dailyLessons";
import { getHandwritingCharacters, normalizeChineseAnswer, scheduleChineseRetry } from "@/lib/chineseWriting";

type CheckState = "idle" | "correct" | "retry";
type PracticePhase = "study" | "cards" | "sentence";

export function ChineseWritingPractice({ practice }: { practice: ChinesePractice }) {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [phase, setPhase] = useState<PracticePhase>("study");
  const [cardQueue, setCardQueue] = useState<number[]>([]);
  const [masteredCards, setMasteredCards] = useState<Set<number>>(() => new Set());
  const [cardAnswer, setCardAnswer] = useState("");
  const [cardCheckState, setCardCheckState] = useState<CheckState>("idle");
  const [answer, setAnswer] = useState("");
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const characters = getHandwritingCharacters(practice.sentence);
  const [selectedCharacter, setSelectedCharacter] = useState(characters[0] ?? "字");
  const [showGuide, setShowGuide] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const currentCardIndex = cardQueue[0];
  const currentCard = currentCardIndex === undefined ? undefined : practice.tokens[currentCardIndex];

  function toggleToken(index: number) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function checkAnswer() {
    const correct = normalizeChineseAnswer(answer) === normalizeChineseAnswer(practice.sentence);
    setCheckState(correct ? "correct" : "retry");
  }

  function beginCards() {
    setCardQueue(practice.tokens.map((_, index) => index));
    setMasteredCards(new Set());
    setCardAnswer("");
    setCardCheckState("idle");
    setPhase("cards");
  }

  function beginSentenceRecall() {
    setAnswer("");
    setCheckState("idle");
    setPhase("sentence");
  }

  function checkCard() {
    if (!currentCard || currentCardIndex === undefined) return;
    const correct = normalizeChineseAnswer(cardAnswer) === normalizeChineseAnswer(currentCard.hanzi);
    setCardCheckState(correct ? "correct" : "retry");
    if (correct) {
      setMasteredCards((current) => new Set(current).add(currentCardIndex));
    }
  }

  function advanceCard() {
    if (currentCardIndex === undefined || cardCheckState === "idle") return;
    const remaining = cardQueue.slice(1);
    const nextQueue = cardCheckState === "retry"
      ? scheduleChineseRetry(remaining, currentCardIndex)
      : remaining;

    if (nextQueue.length === 0) {
      beginSentenceRecall();
      return;
    }

    setCardQueue(nextQueue);
    setCardAnswer("");
    setCardCheckState("idle");
  }

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = point(event);
    context.beginPath();
    context.moveTo(position.x, position.y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 9;
    context.strokeStyle = getComputedStyle(event.currentTarget).color;
    drawing.current = true;
  }

  function continueDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const position = point(event);
    context.lineTo(position.x, position.y);
    context.stroke();
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <section className="chinese-writing" aria-labelledby="chinese-writing-title">
      <header>
        <p className="lesson-step-kicker">LUYỆN TỪ &amp; VIẾT · 3–5 PHÚT</p>
        <h3 id="chinese-writing-title">Hiểu theo cụm, rồi tự viết lại</h3>
        <p>Mỗi thẻ là một cụm có nghĩa, không nhất thiết là một chữ. Chạm thẻ để xem pinyin và nghĩa.</p>
      </header>

      {phase === "study" ? (
        <>
          <div className="chinese-writing__tokens" aria-label="Các cụm trong câu mẫu">
            {practice.tokens.map((token, index) => {
              const isRevealed = revealed.has(index);
              return (
                <button key={`${token.hanzi}-${index}`} type="button" aria-expanded={isRevealed} onClick={() => toggleToken(index)}>
                  <strong lang="zh-Hans">{token.hanzi}</strong>
                  <span className={isRevealed ? "" : "chinese-writing__hidden-hint"}>
                    {isRevealed ? <><span>{token.pinyin}</span><small>{token.meaning}</small></> : "Chạm để mở"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="chinese-writing__translation"><strong>Nghĩa câu:</strong> {practice.translation}</p>
          <button className="button button--primary" type="button" onClick={beginCards}>
            Bắt đầu thẻ nhớ
          </button>
        </>
      ) : phase === "cards" && currentCard ? (
        <div className="chinese-writing__card-round">
          <div className="chinese-writing__progress" aria-label={`Đã nhớ ${masteredCards.size} trên ${practice.tokens.length} cụm`}>
            <span>Thẻ nhớ</span>
            <strong>{masteredCards.size}/{practice.tokens.length} cụm</strong>
          </div>
          <div className="chinese-writing__card">
            <p className="lesson-step-kicker">NHỚ LẠI, KHÔNG CHÉP</p>
            <p>Gõ cụm chữ Hán có nghĩa:</p>
            <strong>“{currentCard.meaning}”</strong>
            <label htmlFor="chinese-card-answer">Cụm chữ Hán</label>
            <input
              id="chinese-card-answer"
              lang="zh-Hans"
              autoComplete="off"
              disabled={cardCheckState !== "idle"}
              value={cardAnswer}
              onChange={(event) => { setCardAnswer(event.target.value); setCardCheckState("idle"); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && cardAnswer.trim() && cardCheckState === "idle") checkCard();
              }}
            />
            {cardCheckState === "idle" ? (
              <button className="button button--primary" type="button" onClick={checkCard} disabled={!cardAnswer.trim()}>
                Kiểm tra thẻ
              </button>
            ) : (
              <button className="button button--primary" type="button" onClick={advanceCard}>
                {cardCheckState === "correct" ? "Thẻ tiếp theo" : "Để thẻ quay lại"}
              </button>
            )}
            <p className={`chinese-writing__feedback chinese-writing__feedback--${cardCheckState}`} aria-live="polite">
              {cardCheckState === "correct" && <>Đúng: <span lang="zh-Hans">{currentCard.hanzi}</span> · {currentCard.pinyin}</>}
              {cardCheckState === "retry" && <>Chưa đúng. Đáp án là <span lang="zh-Hans">{currentCard.hanzi}</span> · {currentCard.pinyin}. Thẻ này sẽ quay lại sau tối đa hai thẻ khác.</>}
            </p>
          </div>
          <button className="button button--ghost" type="button" onClick={beginSentenceRecall}>
            Chỉ còn 5 phút? Luyện cả câu luôn
          </button>
        </div>
      ) : (
        <div className="chinese-writing__recall">
          <p><strong>Mẫu đã ẩn.</strong> Dựa vào nghĩa: “{practice.translation}”</p>
          <label htmlFor="chinese-recall-answer">Gõ lại câu bằng chữ Hán</label>
          <input
            id="chinese-recall-answer"
            lang="zh-Hans"
            autoComplete="off"
            value={answer}
            onChange={(event) => { setAnswer(event.target.value); setCheckState("idle"); }}
          />
          <div className="chinese-writing__actions">
            <button className="button button--primary" type="button" onClick={checkAnswer} disabled={!answer.trim()}>Kiểm tra</button>
            <button className="button button--ghost" type="button" onClick={() => setPhase("study")}>Xem lại các cụm</button>
          </div>
          <p className={`chinese-writing__feedback chinese-writing__feedback--${checkState}`} aria-live="polite">
            {checkState === "correct" && "Đúng câu mẫu. Tiếp theo hãy viết một câu mới ở phần bên dưới."}
            {checkState === "retry" && "Chưa khớp. Hãy xem lại cụm, rồi thử lại; dấu câu và khoảng trắng không bị tính sai."}
          </p>
        </div>
      )}

      <details className="chinese-handwriting">
        <summary>Luyện viết tay một chữ · tùy chọn</summary>
        <p>Chọn chữ, viết bằng ngón tay hoặc chuột. Bảng này không lưu và không tự chấm thứ tự nét.</p>
        <div className="chinese-handwriting__characters" aria-label="Chọn chữ để luyện">
          {characters.map((character) => (
            <button
              key={character}
              type="button"
              aria-pressed={selectedCharacter === character}
              onClick={() => { setSelectedCharacter(character); clearCanvas(); }}
              lang="zh-Hans"
            >
              {character}
            </button>
          ))}
        </div>
        <div className="chinese-handwriting__pad">
          {showGuide && <span aria-hidden="true" lang="zh-Hans">{selectedCharacter}</span>}
          <canvas
            ref={canvasRef}
            width="280"
            height="280"
            aria-label={`Bảng luyện viết chữ ${selectedCharacter}`}
            onPointerDown={startDrawing}
            onPointerMove={continueDrawing}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
          />
        </div>
        <div className="chinese-writing__actions">
          <button className="button button--ghost" type="button" onClick={clearCanvas}>Xóa nét</button>
          <button className="button button--ghost" type="button" aria-pressed={showGuide} onClick={() => setShowGuide((value) => !value)}>
            {showGuide ? "Ẩn chữ mẫu" : "Hiện chữ mẫu"}
          </button>
        </div>
        <p className="lesson-detail__note">Không tiện vẽ? Bài gõ chữ phía trên là lựa chọn tương đương.</p>
      </details>

      <p className="chinese-writing__output-prompt"><strong>Đầu ra để ghi Done:</strong> {practice.outputPrompt}</p>
    </section>
  );
}
