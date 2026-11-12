import type { Metadata } from "next";
import Link from "next/link";
import { SpeakIndex } from "@/components/listening/SpeakRoom";

export const metadata: Metadata = { title: "Phòng nói English" };

export default function SpeakingRoomPage() {
  return (
    <div className="learning-page ll-page">
      <Link href="/learning" className="lesson-detail__back">← Về Learning</Link>
      <header className="section-page__header">
        <h1>Phòng nói English</h1>
        <p>9 tình huống thật, mỗi tình huống 2 trường hợp. Luyện theo một quy trình cố định để nói được mà không cần nhìn: câu khung → nhớ lại → nhập vai → nói liền → ôn đúng lúc.</p>
        <p><Link href="/learning/listening">Phòng nghe (bài nghe, đọc, viết) →</Link></p>
      </header>
      <SpeakIndex />
    </div>
  );
}
