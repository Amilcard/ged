'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, Users, Clock, Heart, ChevronRight } from 'lucide-react';
import type { Stay } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { useApp } from './providers';

export function StayCard({ stay }: { stay: Stay }) {
  const { mode, mounted, isInWishlist, toggleWishlist } = useApp();
  const isKids = mode === 'kids';
  const slug = stay?.slug ?? '';
  const stayId = stay?.id ?? '';
  const isLiked = mounted && isInWishlist(slug);

  const themes = Array.isArray(stay?.themes) ? stay.themes : [];
  const nextSession = stay?.nextSessionStart;

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (slug) toggleWishlist(slug);
  };

  const period = stay?.period === 'printemps' ? 'Printemps' : 'Été';
  const periodColors = stay?.period === 'printemps'
    ? 'bg-green-100 text-green-700 border border-green-200'
    : 'bg-amber-100 text-amber-700 border border-amber-200';

  return (
    <Link href={`/sejour/${stayId}`}>
      <article className="bg-white rounded-xl shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
        <div className="relative aspect-[16/10] bg-primary-100 rounded-t-xl overflow-hidden">
          <Image
            src={stay?.imageCover ?? '/og-image.png'}
            alt={stay?.title ?? 'Séjour'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${periodColors}`}>
              {period}
            </span>
          </div>
          {/* Heart button */}
          <button
            onClick={handleHeartClick}
            className={`absolute top-3 right-3 w-10 h-10 rounded-xl backdrop-blur-sm flex items-center justify-center transition-all duration-200 btn-hover-scale ${
              isLiked
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-white/90 text-primary-400 hover:bg-white hover:text-red-500 shadow-sm'
            }`}
            aria-label={isLiked ? 'Retirer des envies' : 'Ajouter aux envies'}
          >
            <Heart className={`w-5 h-5 transition-transform duration-200 ${isLiked ? 'scale-110' : 'scale-100'}`} />
          </button>
        </div>

        <div className="p-5">
          <h3 className="font-bold text-primary text-lg mb-2 group-hover:text-accent transition-colors">
            {stay?.title ?? 'Sans titre'}
          </h3>

          <p className="text-sm text-primary-600 mb-4 line-clamp-2">
            {stay?.descriptionShort ?? ''}
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {themes.slice(0, 3).map((theme) => (
              <span
                key={theme}
                className="px-2.5 py-1 bg-primary-50 text-primary-600 text-xs rounded-md border border-primary-100"
              >
                {theme}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-primary-500 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{stay?.ageMin ?? 0}-{stay?.ageMax ?? 0} ans</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{stay?.durationDays ?? 0} jours</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{stay?.geography ?? ''}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-primary-100">
            {nextSession && (
              <div className="flex items-center gap-1.5 text-xs text-primary-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(nextSession)}</span>
              </div>
            )}
            {/* Prix masqué : API publique ne retourne pas priceFrom (sécurité) */}
            <span className="inline-flex items-center gap-1 text-accent font-semibold text-base group-hover:gap-2 transition-all">
              {isKids ? 'Découvrir ' : 'Voir le séjour '}
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
