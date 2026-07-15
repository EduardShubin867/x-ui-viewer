import { ClientDashboard } from "@/components/clients/client-dashboard";

export default async function ClientPage({ params }: { params: Promise<{ nodeId: string; email: string }> }) {
  const { nodeId, email } = await params;
  return <ClientDashboard nodeId={decodeURIComponent(nodeId)} email={decodeURIComponent(email)} />;
}
