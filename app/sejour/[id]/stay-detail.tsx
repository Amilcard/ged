'use client';

import { useState, useEffect } from 'react';
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
  X,
  Check,
} from 'lucide-react';
import type { Stay, StaySession } from '@/lib/types';
import { formatDateLong, getWishlistMotivation, addToWishlist } from '@/lib/utils';
import { getPriceBreakdown } from '@/lib/pricing';
import { useApp } from '@/components/providers';
import { BookingModal } from '@/components/booking-modal';
import { WishlistModal } from '@/components/wishlist-modal';

// Types (pas de mention UFOVAL en commentaire)
type DepartureData = { city: string; extra_eur: number };
type SessionData = { date_text: string; base_price_eur: number | null; promo_price_eur: number | null };
type EnrichmentData = { source_url: string; departures: DepartureData[]; sessions: SessionData[] };

// Villes de départ standard (même liste pour tous les séjours)
const STANDARD_CITIES = [
  'Paris', 'Lyon', 'Lille', 'Marseille', 'Bordeaux', 'Rennes'
];

export function StayDetail({ stay }: { stay: Stay & { sessions: StaySession[], price_base?: number | null, price_unit?: string, pro_price_note?: string, sourceUrl?: string | null, geoLabel?: string | null, geoPrecision?: string | null, accommodationLabel?: string | null, contentKids?: any } }) {
  const { mode, mounted, isInWishlist, toggleWishlist, refreshWishlist } = useApp();
  const [showBooking, setShowBooking] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showDepartures, setShowDepartures] = useState(false);

  // Pré-sélection session et ville (avant d'ouvrir le modal)
  const [preSelectedSessionId, setPreSelectedSessionId] = useState<string>('');
  const [preSelectedCity, setPreSelectedCity] = useState<string>('');

  // Initialiser enrichment directement depuis stay.contentKids (données déjà en BDD)
  const stayUrl = String((stay as any)?.sourceUrl ?? "").trim();
  const contentKidsParsed = typeof stay?.contentKids === 'string' ? JSON.parse(stay.contentKids) : stay?.contentKids;
  const allDepartureCities = contentKidsParsed?.departureCities ?? [];
  // Filtrer les villes : uniquement la liste standard + "Sans transport"
  const departureCities = allDepartureCities.filter((dc: DepartureData) =>
    STANDARD_CITIES.some(std =>
      dc.city.toLowerCase().includes(std.toLowerCase())
    ) || dc.city === 'Sans transport'
  );
  const initialEnrichment = (stayUrl && departureCities && departureCities.length > 0) ? {
    source_url: stayUrl,
    departures: departureCities,
    sessions: []
  } : null;
  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(initialEnrichment);

  const isKids = mode === 'kids';
  const isPro = !isKids;
  const slug = stay?.slug ?? '';
  const isLiked = mounted && isInWishlist(slug);

  // Fetch enrichment (sessions avec prix) en mode PRO - compléter les sessions si absent
  useEffect(() => {
    if (!isPro) return;
    if (!stayUrl) return;

    // On a déjà les villes de départ depuis contentKids, on fetche seulement pour les sessions si besoin
    fetch('/api/ufoval-enrichment')
      .then(r => r.json())
      .then((data) => {
        // ✅ API actuelle: { ok, generatedAt, total, stats, items: [...] }
        const list = Array.isArray(data?.items) ? data.items : [];
        const match = list.find((x: any) => String(x?.source_url ?? "").trim() === stayUrl);
        if (match) {
          // Conserver les villes de départ depuis contentKids, ajouter les sessions
          setEnrichment({
            source_url: match.source_url,
            departures: departureCities,
            sessions: match.sessions ?? []
          });
        }
      })
      .catch(() => {});
  }, [isPro, stayUrl, departureCities]);

  // Calcul prix minimum (promo prioritaire, sinon base)
  const minSessionPrice = (() => {
    if (!enrichment?.sessions || enrichment.sessions.length === 0) return null;
    const prices = enrichment.sessions
      .map(s => s.promo_price_eur ?? s.base_price_eur)
      .filter((n): n is number => n !== null && Number.isFinite(n));
    if (prices.length === 0) return null;
    return Math.min(...prices);
  })();

  // Calcul du breakdown de prix dynamique (session + ville sélectionnées)
  const selectedCityData = enrichment?.departures?.find(d => d.city === preSelectedCity);
  const cityExtraEur = selectedCityData?.extra_eur ?? 0;

  const priceBreakdown = getPriceBreakdown({
    sessionPrice: minSessionPrice, // On utilise minSessionPrice car pas de prix par session individuelle
    cityExtraEur,
    optionType: null, // Options choisies dans le modal uniquement
    minSessionPrice,
  });

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
      <section className="relative h-[45vh] min-h-[320px]">
        <Image
          src={stay?.imageCover ?? '/og-image.png'}
          alt={stay?.title ?? ''}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Action buttons (top right) */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={handleShare}
            className="w-11 h-11 bg-white/95 backdrop-blur rounded-xl flex items-center justify-center text-primary hover:bg-white transition-all shadow-sm"
            aria-label="Partager"
          >
            <Share2 className="w-5 h-5" />
          </button>
          {stay?.pdfUrl ? (
            <a
              href={stay.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 bg-white/95 backdrop-blur rounded-xl flex items-center justify-center text-primary hover:bg-white transition-all shadow-sm"
              aria-label="Télécharger le PDF"
            >
              <Download className="w-5 h-5" />
            </a>
          ) : (
            <span className="text-xs text-white/90 bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-sm">
              PDF bientôt disponible
            </span>
          )}
          <button
            onClick={handleToggleWishlist}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-sm ${
              isLiked
                ? 'bg-red-500 text-white'
                : 'bg-white/95 backdrop-blur text-primary hover:bg-white hover:text-red-500'
            }`}
            aria-label={isLiked ? 'Retirer des envies' : 'Ajouter aux envies'}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Share success toast */}
        {shareSuccess && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium animate-in slide-in-from-top shadow-lg">
            Lien copié !
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-6 max-w-6xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-1 text-white/90 text-sm mb-3 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour aux séjours
          </Link>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">{stay?.title ?? ''}</h1>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
        {/* Quick Info Card */}
        <div className="bg-white rounded-xl shadow-card p-6 mb-8 md:mb-12">
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
              <div className="text-right">
                {priceBreakdown.minPrice !== null ? (
                  <div className="space-y-1">
                    {/* Prix minimum "À partir de" */}
                    <div className="text-sm text-primary-500">
                      À partir de <span className="font-semibold">{priceBreakdown.minPrice} €</span>
                    </div>
                    {/* Estimation dynamique (si sélection) */}
                    {priceBreakdown.hasSelection && priceBreakdown.total !== null && cityExtraEur > 0 && (
                      <div className="bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
                        <div className="text-xs text-primary-600 mb-0.5">Votre estimation</div>
                        <div className="text-lg font-bold text-accent">{priceBreakdown.total} €</div>
                        <div className="text-xs text-primary-500">
                          ({priceBreakdown.baseSession}€ + {cityExtraEur}€ transport)
                        </div>
                      </div>
                    )}
                    {!priceBreakdown.hasSelection && (
                      <div className="text-xs text-primary-400">
                        Sans transport inclus
                      </div>
                    )}
                  </div>
                ) : stay?.price_base == null ? (
                  <div className="text-sm text-primary-500 italic">
                    {stay?.pro_price_note || "Tarif communiqué aux professionnels"}
                  </div>
                ) : (
                  <div className="text-base font-bold text-accent">
                    À partir de {stay.price_base} €
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8 md:space-y-10">
            {/* Description */}
            <section className="bg-white rounded-xl shadow-card p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-bold text-primary mb-4">
                {isKids ? 'C\'est quoi ce séjour ?' : 'Présentation'}
              </h2>
              <p className="text-primary-600 leading-relaxed">{stay?.descriptionShort ?? ''}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {themes.map(theme => (
                  <span key={theme} className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-600 rounded-full text-sm font-medium border border-primary-100">
                    <Tag className="w-3 h-3" /> {theme}
                  </span>
                ))}
              </div>
            </section>

            {/* Mini Programme */}
            <section className="bg-white rounded-xl shadow-card p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-bold text-primary mb-4">
                {isKids ? 'Au programme' : 'Programme en bref'}
              </h2>
              <ul className="space-y-3">
                {miniProgramme.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <ChevronRight className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-primary-600">{item}</span>
                  </li>
                ))}
              </ul>
              {programme.length > miniProgramme.length && (
                <p className="text-sm text-primary-400 mt-3">+ {programme.length - miniProgramme.length} activités supplémentaires</p>
              )}
            </section>

            {/* Full Programme */}
            <section className="bg-white rounded-xl shadow-card p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-bold text-primary mb-4">
                {isKids ? 'Tout le programme' : 'Programme détaillé'}
              </h2>
              <ol className="space-y-4">
                {programme.map((item, i) => (
                  <li key={i} className="flex items-start gap-4 pb-4 border-b border-primary-100 last:border-0">
                    <span className="w-7 h-7 bg-accent/10 text-accent text-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-primary-600">{item}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* 3 Columns - Lieu/Hébergement/Encadrement */}
            <div className="grid md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-5 border border-primary-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-bold text-primary text-lg">Lieu</h3>
                </div>
                <p className="text-sm text-primary-600 font-medium">
                  {(stay as any)?.geoLabel && (stay as any)?.geoPrecision
                    ? `${ (stay as any).geoLabel } (${ (stay as any).geoPrecision })`
                    : (stay as any)?.geoLabel || stay?.geography || ''}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5 border border-primary-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Home className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-bold text-primary text-lg">Hébergement</h3>
                </div>
                <p className="text-sm text-primary-600 font-medium">{(stay as any)?.accommodationLabel || stay?.accommodation || ''}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5 border border-primary-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-bold text-primary text-lg">Encadrement</h3>
                </div>
                <p className="text-sm text-primary-600 font-medium">{stay?.supervision ?? ''}</p>
              </div>
            </div>

            {/* Ville de départ + Option suivi éducatif */}
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white rounded-xl shadow-card p-5 border border-accent/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Bus className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-primary text-lg">Villes de départ</h3>
                    {enrichment?.departures && enrichment.departures.length > 0 && (
                      <p className="text-xs text-primary-500 font-medium mt-0.5">
                        {enrichment.departures.length} villes disponibles
                      </p>
                    )}
                  </div>
                </div>

                {enrichment?.departures && enrichment.departures.length > 0 ? (
                  <div className="space-y-3">
                    {/* Aperçu des villes cliquables (tri standard) */}
                    <div className="flex flex-wrap gap-1.5">
                      {enrichment.departures
                        .slice()
                        .sort((a, b) => {
                          if (a.city === 'Sans transport') return -1;
                          if (b.city === 'Sans transport') return 1;
                          const aIndex = STANDARD_CITIES.findIndex(std => a.city.toLowerCase().includes(std.toLowerCase()));
                          const bIndex = STANDARD_CITIES.findIndex(std => b.city.toLowerCase().includes(std.toLowerCase()));
                          if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
                          if (aIndex >= 0) return -1;
                          if (bIndex >= 0) return 1;
                          return a.city.localeCompare(b.city);
                        })
                        .slice(0, 4)
                        .map((dep, i) => {
                          const isCitySelected = preSelectedCity === dep.city;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setPreSelectedCity(dep.city)}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border-2 transition-all flex items-center gap-1.5 ${
                                isCitySelected
                                  ? 'border-accent bg-accent text-white'
                                  : 'border-accent/20 bg-accent/5 text-accent hover:border-accent/40'
                              }`}
                            >
                              {isCitySelected && <Check className="w-3 h-3" />}
                              {dep.city === 'Sans transport' ? 'Sans transport' : dep.city}
                              {!isKids && !isCitySelected && (
                                <span className="text-accent/70">
                                  {dep.extra_eur === 0 ? '' : `+${dep.extra_eur}€`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      {enrichment.departures.length > 4 && (
                        <button
                          type="button"
                          onClick={() => setShowDepartures(true)}
                          className="px-2.5 py-1.5 bg-primary-50 text-primary-500 text-xs font-medium rounded-lg hover:bg-primary-100 transition-colors"
                        >
                          +{enrichment.departures.length - 4}
                        </button>
                      )}
                    </div>

                    {/* Indication sélection */}
                    {preSelectedCity && (
                      <div className="flex items-center gap-2 text-xs text-accent font-medium bg-accent/5 px-3 py-2 rounded-lg">
                        <Check className="w-3.5 h-3.5" />
                        Ville sélectionnée : {preSelectedCity}
                        {!isKids && (() => {
                          const cityData = enrichment.departures.find(d => d.city === preSelectedCity);
                          return cityData && cityData.extra_eur > 0 ? ` (+${cityData.extra_eur}€)` : ' (inclus)';
                        })()}
                      </div>
                    )}

                    {/* CTA voir toutes les villes */}
                    <button
                      onClick={() => setShowDepartures(true)}
                      className="w-full py-2.5 bg-primary-100 text-primary-700 rounded-xl font-semibold text-sm hover:bg-primary-200 transition-all flex items-center justify-center gap-2"
                    >
                      Voir toutes les villes
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Prix min (Pro seulement) */}
                    {!isKids && !preSelectedCity && (
                      <p className="text-xs text-center text-primary-500">
                        Transport inclus • Supplément à partir de{' '}
                        <span className="font-semibold">
                          {Math.min(...enrichment.departures.filter(d => d.extra_eur > 0).map(d => d.extra_eur))}€
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-primary-600 italic">
                    {stay?.departureCity || 'Départ : à confirmer'}
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-accent" />
                    <h3 className="font-semibold text-primary">
                      {isKids ? "Un accompagnement pour toi" : "Encadrement individualisé"}
                    </h3>
                  </div>
                  {/* Pastille 1+1 sobre */}
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent text-xs font-semibold rounded-lg border border-accent/20">
                    <Users className="w-3 h-3" />
                    1+1
                  </span>
                </div>
                {isKids ? (
                  <div className="text-sm text-primary-600 space-y-2">
                    <p>
                      Si tu en as besoin, on peut te proposer un accompagnement renforcé pour que le séjour se passe au mieux.
                    </p>
                    <p className="text-primary-500">
                      Un animateur référent peut t'accompagner tout au long du séjour. Ton adulte référent et ta structure valident avec nous ce qui est le mieux pour toi.
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-primary-600 space-y-3">
                    <p className="font-medium text-primary">
                      Partir avec Groupe & Découverte, c'est la garantie de bénéficier d'un accompagnement individualisé.
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-accent mt-0.5">•</span>
                        <span>Un accompagnement personnalisé sur la recherche du séjour de vacances</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-accent mt-0.5">•</span>
                        <span>La connaissance du projet associatif de notre partenaire</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-accent mt-0.5">•</span>
                        <span>Un suivi adapté sur toute la durée du séjour</span>
                      </li>
                    </ul>
                    <p className="text-primary-700 font-medium border-t border-primary-100 pt-3 mt-3">
                      Selon la situation, un animateur référent peut être mis à disposition tout au long du séjour.
                    </p>
                  </div>
                )}
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
                    const isSelected = preSelectedSessionId === session?.id;
                    return (
                      <button
                        key={session?.id}
                        type="button"
                        disabled={isFull}
                        onClick={() => !isFull && setPreSelectedSessionId(session?.id ?? '')}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                            : isFull
                            ? 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                            : 'border-primary-100 bg-primary-50 hover:border-primary-200 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Indicateur de sélection */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                            isSelected
                              ? 'border-accent bg-accent'
                              : isFull
                              ? 'border-red-300 bg-red-100'
                              : 'border-primary-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1">
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
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {isKids ? (
                <button
                  onClick={handleKidsCTA}
                  className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent-600 transition-all btn-hover-lift shadow-sm active:scale-95"
                >
                  Ce séjour m&apos;intéresse
                </button>
              ) : (
                <button
                  onClick={() => setShowBooking(true)}
                  disabled={sessions.filter(s => (s?.seatsLeft ?? 0) > 0).length === 0}
                  className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent-600 transition-all btn-hover-lift shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  Réserver ce séjour
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBooking && (
        <BookingModal
          stay={stay}
          sessions={sessions}
          departureCities={enrichment?.departures}
          sessionBasePrice={minSessionPrice}
          initialSessionId={preSelectedSessionId}
          initialCity={preSelectedCity}
          onClose={() => setShowBooking(false)}
        />
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

      {/* Modal villes de départ */}
      {showDepartures && enrichment?.departures && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDepartures(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-primary-100 p-6 pb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-primary text-xl">Villes de départ</h2>
                <p className="text-sm text-primary-500 mt-1">
                  {isPro
                    ? `${enrichment.departures.length} villes • Tarifs incluant le transport`
                    : `${enrichment.departures.length} villes disponibles`
                  }
                </p>
              </div>
              <button onClick={() => setShowDepartures(false)} className="p-2 hover:bg-primary-50 rounded-xl transition-colors">
                <X className="w-5 h-5 text-primary" />
              </button>
            </div>
            <div className="p-4 space-y-1 max-h-[50vh] overflow-y-auto">
              {isKids && (
                <p className="text-xs text-primary-500 italic mb-3 px-2">
                  Choix confirmé lors de l&apos;inscription
                </p>
              )}
              {enrichment.departures
                .slice()
                .sort((a, b) => {
                  // Mettre "Sans transport" en premier, puis trier selon STANDARD_CITIES
                  if (a.city === 'Sans transport') return -1;
                  if (b.city === 'Sans transport') return 1;
                  const aIndex = STANDARD_CITIES.findIndex(std => a.city.toLowerCase().includes(std.toLowerCase()));
                  const bIndex = STANDARD_CITIES.findIndex(std => b.city.toLowerCase().includes(std.toLowerCase()));
                  if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
                  if (aIndex >= 0) return -1;
                  if (bIndex >= 0) return 1;
                  return a.city.localeCompare(b.city);
                })
                .map((dep, i) => {
                  const isCitySelected = preSelectedCity === dep.city;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPreSelectedCity(dep.city);
                        // Fermer la modal après sélection
                        setTimeout(() => setShowDepartures(false), 150);
                      }}
                      className={`w-full flex items-center justify-between py-3 px-4 rounded-xl transition-all ${
                        isCitySelected
                          ? 'bg-accent/10 border-2 border-accent'
                          : 'hover:bg-primary-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Indicateur de sélection */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isCitySelected
                            ? 'border-accent bg-accent'
                            : 'border-primary-300'
                        }`}>
                          {isCitySelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-sm font-medium capitalize ${isCitySelected ? 'text-accent' : 'text-primary-700'}`}>
                          {dep.city}
                        </span>
                      </div>
                      {!isKids && (
                        <span className={`text-sm font-semibold ${isCitySelected ? 'text-accent' : 'text-primary-600'}`}>
                          {dep.extra_eur === 0 ? 'Inclus' : `+${dep.extra_eur}€`}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
