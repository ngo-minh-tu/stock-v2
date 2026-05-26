// Cluster 6 §4.3 — public Shared View. Sits OUTSIDE the (app) layout group, so
// ProtectedRoute + AppShell don't apply. Token validation is done client-side via
// the SharedView component (which calls /api/share/{token}).

import { SharedView } from '@/components/share/SharedView';

// Tokens are dynamic; we must not statically generate this route.
export const dynamic = 'force-dynamic';

// Next 15+ async params (Phase 24): dynamic route params resolve via a Promise.
interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  return <SharedView token={token} />;
}
