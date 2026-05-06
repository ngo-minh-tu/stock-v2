'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Disclaimer } from './Disclaimer';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-close mobile drawer on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex">
      <Sidebar isOpen={drawerOpen} onNavigate={() => setDrawerOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuToggle={() => setDrawerOpen((value) => !value)} />

        <main className="flex-1 px-6 py-6 overflow-y-auto">{children}</main>

        <Disclaimer />
      </div>
    </div>
  );
}
