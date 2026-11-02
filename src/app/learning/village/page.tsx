import type { Metadata } from "next";
import Link from "next/link";
import VillageGame from "@/components/village/VillageGame";

export const metadata: Metadata = {
  title: "Làng Rêu",
  description: "Xây một ngôi làng nhỏ trên đảo bay; học từ tiếng Anh để mở thêm đồ xây.",
};

export default function VillagePage() {
  return (
    <div className="learning-page">
      <Link href="/learning/world" className="lesson-detail__back">← Về Learning Farm</Link>
      <header className="section-page__header">
        <h1>Làng Rêu</h1>
        <p>
          Vẽ đường, xây tường, đặt nhà trên một hòn đảo bay. Tường cắt qua đường tự mở cổng vòm, góc tường mọc tháp.
          Học một từ tiếng Anh để mở thêm tháp, giếng, ao, cối xay gió, đèn lồng và cừu. Đây là trò chơi để thư giãn,
          không tính vào Done, nhịp học hay trình độ.
        </p>
      </header>
      <VillageGame />
    </div>
  );
}
