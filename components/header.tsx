'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from './providers';
import { Logo } from './logo';
import { Users, Baby, Menu, X, RotateCcw } from 'lucide-react';

const navItems = [
  { label: 'Accueil', route: '/' },
  { label: 'Séjours', route: '/sejours' },
  { label: 'Infos', route: '/infos' },
  { label: 'Contact', route: '/contact' },
];

export function Header() {
  const { mode, setMode, reset, mounted, isAuthenticated, authUser } = useApp();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (route: string) => {
    if (route === '/') return pathname === '/';
    return pathname?.startsWith(route);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-primary-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 hover:opacity-90 transition-opacity">
            <Logo variant="default" className="hidden sm:flex" />
            <Logo variant="compact" className="flex sm:hidden" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.route}
                href={item.route}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.route)
                    ? 'text-accent bg-accent/5'
                    : 'text-primary-600 hover:text-primary hover:bg-primary-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated && authUser && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-lg text-sm font-medium text-accent hover:bg-accent/5 transition-all"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Right Section: Mode Toggle + Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Pro/Kids Toggle */}
            {mounted && (
              <div className="flex items-center gap-1 bg-primary-50 rounded-xl p-1">
                <button
                  onClick={() => setMode('pro')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                    mode === 'pro'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-primary-600 hover:bg-primary-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Pro</span>
                </button>
                <button
                  onClick={() => setMode('kids')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                    mode === 'kids'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-primary-600 hover:bg-primary-100'
                  }`}
                >
                  <Baby className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Kids</span>
                </button>
              </div>
            )}

            {/* Reset button (desktop only) */}
            {mounted && (
              <button
                onClick={reset}
                className="hidden sm:flex p-2 text-primary-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-all"
                title="Réinitialiser"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-primary hover:bg-primary-50 rounded-lg transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-primary-100 animate-in slide-in-from-top">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.route}
                  href={item.route}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.route)
                      ? 'text-accent bg-accent/5'
                      : 'text-primary-600 hover:bg-primary-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {isAuthenticated && authUser && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-accent hover:bg-accent/5 transition-all"
                >
                  Admin
                </Link>
              )}
              {/* Reset in mobile menu */}
              {mounted && (
                <button
                  onClick={() => {
                    reset();
                    setMobileMenuOpen(false);
                  }}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-primary-400 hover:bg-primary-50 text-left flex items-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Réinitialiser
                </button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
