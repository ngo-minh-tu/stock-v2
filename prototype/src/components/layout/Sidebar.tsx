'use client';

import {
  AlertTriangle,
  Briefcase,
  History,
  LayoutDashboard,
  LineChart,
  Newspaper,
  PieChart,
  Settings as SettingsIcon,
  Table,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface NavItem {
  href: string;
  labelKey: string;
  Icon: LucideIcon;
}

// Order per cluster prompt §8.1.
const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', labelKey: 'dashboard', Icon: LayoutDashboard },
  { href: '/top-mua', labelKey: 'topMua', Icon: PieChart },
  { href: '/red-flags', labelKey: 'redFlags', Icon: AlertTriangle },
  { href: '/stock-detail', labelKey: 'stockDetail', Icon: LineChart },
  { href: '/price-board', labelKey: 'priceBoard', Icon: Table },
  { href: '/news', labelKey: 'news', Icon: Newspaper },
  { href: '/portfolio', labelKey: 'portfolio', Icon: Briefcase },
  { href: '/run-history', labelKey: 'runHistory', Icon: History },
  { href: '/settings', labelKey: 'settings', Icon: SettingsIcon },
];

interface SidebarProps {
  isOpen: boolean;
  onNavigate: () => void;
}

export function Sidebar({ isOpen, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <>
      {/* Mobile drawer backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 md:hidden transition-opacity ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onNavigate}
        aria-hidden="true"
      />

      <aside
        className={`fixed md:sticky top-0 z-40 h-screen border-r flex flex-col
          transition-transform duration-200
          w-60 md:w-16 lg:w-60
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0`}
        style={{
          backgroundColor: 'var(--color-theme-secondary)',
          borderColor: 'var(--color-theme-charcoal)',
        }}
        aria-label="Primary navigation"
      >
        <nav className="flex flex-col gap-1 p-3 md:p-2 lg:p-3 mt-14 md:mt-0 overflow-y-auto">
          {NAV_ITEMS.map(({ href, labelKey, Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                title={t(labelKey)}
                className={`flex items-center gap-3 px-3 py-2 md:px-2 md:justify-center lg:px-3 lg:justify-start rounded text-sm transition-colors
                  ${isActive ? 'font-bold' : ''}`}
                style={{
                  color: isActive
                    ? 'var(--color-theme-text-tertiary)'
                    : 'var(--color-theme-text-primary)',
                  backgroundColor: isActive ? 'var(--color-theme-tertiary)' : 'transparent',
                  borderLeft: isActive
                    ? '3px solid var(--color-theme-crimson)'
                    : '3px solid transparent',
                }}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="md:hidden lg:inline">{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
