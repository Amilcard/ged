'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Home,
  Users,
  Calendar,
  Clock,
  ChevronRight,
  Tag,
  Heart,
  Share2,
  Bus,
  GraduationCap,
  Download,
} from 'lucide-react';
import type { Stay, StaySession } from '@/lib/types';
import { formatDateLong, getWishlistMotivation, addToWishlist } from '@/lib/utils';
import { useApp } from '@/components/providers';
import { BookingModal } from '@/components/booking-modal';
import { WishlistModal } from '@/components/wishlist-modal';

export function StayDetail({ stay }: { stay: Stay & { sessions: StaySession[], price_base?: number | null, price_unit?: string, pro_price_note?: string } }) {
  const { mode, mounted, isInWishlist, toggleWishlist, refreshWishlist } = useApp();
  const [showBooking, setShowBooking] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const isKids = mode === 'kids';
  const slug = stay?.slug ?? '';
  const isLiked = mounted && isInWishlist(slug);

  const handleToggleWishlist = () => {
    if (slug) toggleWishlist(slug);
  };

  const handleKidsCTA = () => {
    // Add to wishlist and show modal
    if (slug && !isLiked) {
      addToWishlist(slug);
      refreshWishlist();
    }
    setShowWishlistModal(true);
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = stay?.title ?? 'Séjour';
    const motivation = getWishlistMotivation(slug);
    const text = motivation 
      ? `Ce séjour m'intéresse : ${title}\nPourquoi : ${motivation}`
      : `Ce séjour m'intéresse : ${title}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // User cancelled or error
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch {
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
      }
    }
  };

  const programme = Array.isArray(stay?.programme) ? stay.programme : [];
  const themes = Array.isArray(stay?.themes) ? stay.themes : [];
  const sessions = stay?.sessions ?? [];
  const miniProgramme = programme.slice(0, 5);

  return (
    <main className="pb-12">
      {/* Hero */}
      <section className="relative h-[40vh] min-h-[280px]">
        <Image
          src={stay?.imageCover ?? '/og-image.png'}
          alt={stay?.title ?? ''}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Action buttons (top right) */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={handleShare}
            className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-primary hover:bg-white transition-all"
            aria-label="Partager"
          >
            <Share2 className="w-5 h-5" />
          </button>
          {stay?.pdfUrl ? (
            <a
              href={stay.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-primary hover:bg-white transition-all"
              aria-label="Télécharger le PDF"
            >
              <Download className="w-5 h-5" />
            </a>
          ) : (
            <span className="text-xs text-white/80 bg-black/30 px-2 py-1 rounded-full">
              PDF bientôt disponible
            </span>
          )}
          <button
            onClick={handleToggleWishlist}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isLiked
                ? 'bg-red-500 text-white'
                : 'bg-white/90 text-primary hover:bg-white hover:text-red-500'
            }`}
            aria-label={isLiked ? 'Retirer des envies' : 'Ajouter aux envies'}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>
        
        {/* Share success toast */}
        {shareSuccess && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium animate-in slide-in-from-top">
            Lien copié !
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-6 max-w-6xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-1 text-white/80 text-sm mb-3 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Retour aux séjours
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-white">{stay?.title ?? ''}</h1>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
        {/* Quick Info Card */}
        <div className="bg-white rounded-xl shadow-card p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2 text-primary-600">
                <Calendar className="w-4 h-4 text-accent" />
                <span>{stay?.period === 'printemps' ? 'Printemps' : 'Été'} 2026</span>
              </div>
              <div className="flex items-center gap-2 text-primary-600">
                <Clock className="w-4 h-4 text-accent" />
                <span>{stay?.durationDays ?? 0} jours</span>
              </div>
              <div className="flex items-center gap-2 text-primary-600">
                <Users className="w-4 h-4 text-accent" />
                <span>{stay?.ageMin ?? 0}-{stay?.ageMax ?? 0} ans</span>
              </div>
              <div className="flex items-center gap-2 text-primary-600">
                <MapPin className="w-4 h-4 text-accent" />
                <span>{stay?.geography ?? ''}</span>
              </div>
            </div>
            {/* Prix / note tarif (Pro) */}
            {mounted && !isKids && (
              <div className="text-sm text-primary-500 italic">
                {stay?.price_base == null
                  ? (stay?.pro_price_note || "Tarif communiqué aux professionnels")
                  : `${stay.price_base}${stay?.price_unit ? ` ${stay.price_unit}` : ""}`}
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <section className="bg-white rounded-xl shadow-card p-6">
              <h2 className="text-xl font-semibold text-primary mb-4">
                {isKids ? 'C\'est quoi ce séjour ?' : 'Présentation'}
              </h2>
              <p className="text-primary-600 leading-relaxed">{stay?.descriptionShort ?? ''}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {themes.map(theme => (
                  <span key={theme} className="flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-sm">
                    <Tag className="w-3 h-3" /> {theme}
                  </span>
                ))}
              </div>
            </section>

            {/* Mini Programme */}
            <section className="bg-white rounded-xl shadow-card p-6">
              <h2 className="text-xl font-semibold text-primary mb-4">
                {isKids ? 'Au programme' : 'Programme en bref'}
              </h2>
              <ul className="space-y-2">
                {miniProgramme.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-primary-600">{item}</span>
                  </li>
                ))}
              </ul>
              {programme.length > miniProgramme.length && (
                <p className="text-sm text-primary-400 mt-3">+ {programme.length - miniProgramme.length} activités supplémentaires</p>
              )}
            </section>

            {/* Full Programme */}
            <section className="bg-white rounded-xl shadow-card p-6">
              <h2 className="text-xl font-semibold text-primary mb-4">
                {isKids ? 'Tout le programme' : 'Programme détaillé'}
              </h2>
              <ol className="space-y-3">
                {programme.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 pb-3 border-b border-primary-100 last:border-0">
                    <span className="w-6 h-6 bg-accent/10 text-accent text-xs font-semibold rounded-full flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-primary-600">{item}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* 3 Columns - Lieu/Hébergement/Encadrement */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-primary">Lieu</h3>
                </div>
                <p className="text-sm text-primary-600">{stay?.geography ?? ''}</p>
              </div>
              <div className="bg-white rounded-xl shadow-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Home className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-primary">Hébergement</h3>
                </div>
                <p className="text-sm text-primary-600">{stay?.accommodation ?? ''}</p>
              </div>
              <div className="bg-white rounded-xl shadow-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-primary">Encadrement</h3>
                </div>
                <p className="text-sm text-primary-600">{stay?.supervision ?? ''}</p>
              </div>
            </div>

            {/* Ville de départ + Option suivi éducatif */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Bus className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-primary">
                    {isKids ? 'On part d\'où ?' : 'Ville de départ'}
                  </h3>
                </div>
                <p className="text-sm text-primary-600">
                  {stay?.departureCity || 'Départ : à confirmer'}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-primary">
                    {isKids ? 'Suivi pendant le séjour' : 'Option suivi éducatif'}
                  </h3>
                </div>
                <p className="text-sm text-primary-600">
                  {stay?.educationalOption || 'Option non disponible pour ce séjour'}
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 bg-white rounded-xl shadow-card p-6">
              <h3 className="font-semibold text-primary mb-4">Sessions disponibles</h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-primary-500">Aucune session disponible</p>
              ) : (
                <div className="space-y-3 mb-6">
                  {sessions.map(session => {
                    const isFull = (session?.seatsLeft ?? 0) === 0;
                    return (
                      <div 
                        key={session?.id}
                        className={`p-3 rounded-lg border ${
                          isFull ? 'border-red-200 bg-red-50' : 'border-primary-100 bg-primary-50'
                        }`}
                      >
                        <div className="text-sm font-medium text-primary">
                          {formatDateLong(session?.startDate ?? '')}
                        </div>
                        <div className="text-xs text-primary-500">
                          au {formatDateLong(session?.endDate ?? '')}
                        </div>
                        <div className={`text-xs mt-1 ${isFull ? 'text-red-500' : 'text-green-600'}`}>
                          {isFull ? 'Complet' : `${session?.seatsLeft ?? 0} places`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {isKids ? (
                <button
                  onClick={handleKidsCTA}
                  className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-600 transition-colors"
                >
                  Ce séjour m&apos;intéresse
                </button>
              ) : (
                <button
                  onClick={() => setShowBooking(true)}
                  disabled={sessions.filter(s => (s?.seatsLeft ?? 0) > 0).length === 0}
                  className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Réserver ce séjour
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBooking && (
        <BookingModal stay={stay} sessions={sessions} onClose={() => setShowBooking(false)} />
      )}

      {showWishlistModal && (
        <WishlistModal
          isOpen={showWishlistModal}
          onClose={() => setShowWishlistModal(false)}
          stayTitle={stay?.title ?? ''}
          staySlug={slug}
          stayUrl={typeof window !== 'undefined' ? window.location.href : ''}
        />
      )}
    </main>
  );
}
