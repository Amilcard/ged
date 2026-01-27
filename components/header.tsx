'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from './providers';
import { Mountain, Users, Baby, RotateCcw } from 'lucide-react';

const desktopNavItems = [
  { label: 'Accueil', route: '/' },
  { label: 'Séjours', route: '/sejours' },
  { label: 'Infos', route: '/infos' },
  { label: 'Espace pro', route: '/login' },
];

export function Header() {
  const { mode, setMode, reset, mounted, isAuthenticated, authUser } = useApp();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-primary-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary font-semibold text-lg">
          <Mountain className="w-6 h-6" />
          <span className="hidden sm:inline">Groupe & Découverte</span>
          <span className="sm:hidden">G&D</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {desktopNavItems.map((item) => (
            <Link
              key={item.route}
              href={item.route}
              className={`text-sm font-medium transition-colors ${
                pathname === item.route || (item.route === '/' && pathname === '/')
                  ? 'text-primary'
                  : 'text-gray-600 hover:text-primary'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {isAuthenticated && authUser && (
            <Link
              href="/admin"
              className="text-sm font-medium text-accent hover:text-accent/80 transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {mounted && (
            <>
              <div className="flex bg-primary-50 rounded-lg p-1">
                <button
                  onClick={() => setMode('pro')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-all ${
                    mode === 'pro'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-primary-600 hover:text-primary'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Pro
                </button>
                <button
                  onClick={() => setMode('kids')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-all ${
                    mode === 'kids'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-primary-600 hover:text-primary'
                  }`}
                >
                  <Baby className="w-4 h-4" />
                  Kids
                </button>
              </div>
              <button
                onClick={reset}
                className="p-2 text-primary-400 hover:text-primary transition-colors"
                title="Réinitialiser"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
