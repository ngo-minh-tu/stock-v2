// Cluster 6 §4.3 — public Shared View. Sits OUTSIDE the (app) layout group, so
// ProtectedRoute + AppShell don't apply. Token validation is done client-side via
// the SharedView component (which calls /api/share/{token}).

import { SharedView } from '@/components/share/SharedView';

// Tokens are dynamic; we must not statically generate this route.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { token: string };
}

export default function SharePage({ params }: PageProps) {
  return <SharedView token={params.token} />;
}
