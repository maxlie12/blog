import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpeakPractice } from "@/components/listening/SpeakRoom";
import { SITUATIONS, speakSituation } from "@/lib/speakingRoom";

export function generateStaticParams() {
  return SITUATIONS.map((item) => ({ situationId: item.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ situationId: string }> }): Promise<Metadata> {
  const { situationId } = await params;
  return { title: speakSituation(situationId)?.titleVi ?? "Phòng nói" };
}

export default async function SpeakingSituationPage({ params }: { params: Promise<{ situationId: string }> }) {
  const { situationId } = await params;
  const situation = speakSituation(situationId);
  if (!situation) notFound();
  const following = SITUATIONS[SITUATIONS.indexOf(situation) + 1];
  return (
    <div className="learning-page ll-page">
      <Link href="/learning/speaking" className="lesson-detail__back">← Phòng nói</Link>
      <SpeakPractice situation={situation} next={following ? { id: following.id, title: following.titleVi } : null} />
    </div>
  );
}
