import { notFound } from "next/navigation";
import { ConversationPractice } from "@/components/ConversationPractice";
import { conversationScenario } from "@/lib/conversationPractice";

export const metadata = { title: "Luyện giao tiếp theo tình huống" };
export default async function ConversationPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { scenario = "en-clarify" } = await searchParams;
  if (!conversationScenario(scenario)) notFound();
  return <ConversationPractice key={scenario} scenarioId={scenario} />;
}
