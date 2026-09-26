import { requireStudioSession } from "@/lib/studioSession";
import { StudioSidebar } from "@/components/studio/StudioSidebar";

export default async function StudioDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStudioSession();

  return (
    <div className="studio-shell">
      <StudioSidebar />
      <div className="studio-content">{children}</div>
    </div>
  );
}
