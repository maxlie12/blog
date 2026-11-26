import type { Metadata } from "next";
import Link from "next/link";
import { SpeakIndex } from "@/components/listening/SpeakRoom";
import { SITUATIONS } from "@/lib/speakingRoom";

export const metadata: Metadata = { title: "Phòng nói English" };

export default function SpeakingRoomPage() {
  return (
    <div className="learning-page ll-page">
      <Link href="/learning" className="lesson-detail__back">← Về Learning</Link>
      <header className="section-page__header">
        <h1>Phòng nói English</h1>
        <p>{SITUATIONS.length} tình huống thật (có mời trà và phiên dịch buổi thưởng trà), mỗi tình huống 2 trường hợp. Luyện theo một quy trình cố định để nói được mà không cần nhìn: câu khung → nhớ lại → nhập vai → nói liền → ôn đúng lúc.</p>
        <p><Link href="/learning/listening">Phòng nghe (bài nghe, đọc, viết) →</Link></p>
      </header>
      <SpeakIndex />
    </div>
  );
}
