/**
 * GED Pricing Rules Module
 * Centralise toutes les règles de tarification GED
 *
 * Règles :
 * - Surcoûts durée : +180€ (7j), +310€ (14j), +450€ (21j)
 * - Proratisation : 6, 8, 12, 13 jours (référence 14j)
 * - Ville départ : +12€ fixe (10 villes GED)
 * - Promo : 5% sur prix final
 */

export type GedDuration = 6 | 7 | 8 | 12 | 13 | 14 | 21;

export type GedDepartureCity =
  | 'paris'
  | 'lyon'
  | 'rennes'
  | 'toulouse'
  | 'valence'
  | 'grenoble'
  | 'marseille'
  | 'strasbourg'
  | 'lille'
  | 'bordeaux';

interface GedPricingConfig {
  DURATION_SURCHARGE: Record<number, number>;
  PRORATA_DURATIONS: GedDuration[];
  PRORATA_REFERENCE: Record<number, number>;
  DEPARTURE_CITIES: GedDepartureCity[];
  DEPARTURE_SUPPLEMENT: number;
  PROMO_RATE: number;
}

/**
 * Classe de calcul des prix GED
 */
export class GedPricing {
  private static readonly CONFIG: GedPricingConfig = {
    // Surcoûts fixes selon durée
    DURATION_SURCHARGE: {
      7: 180,   // euros
      14: 310,
      21: 450
    },

    // Durées à proratiser
    PRORATA_DURATIONS: [6, 8, 12, 13],

    // Références pour prorata
    PRORATA_REFERENCE: {
      7: 7,    // durée 7j réf = durée 7j
      14: 14  // durée 14j réf = durée 14j
    },

    // 10 villes de départ GED
    DEPARTURE_CITIES: [
      'paris', 'lyon', 'rennes', 'toulouse', 'valence',
      'grenoble', 'marseille', 'strasbourg', 'lille', 'bordeaux'
    ],

    // Supplément fixe par ville
    DEPARTURE_SUPPLEMENT: 12, // euros

    // Promo actuelle : 5%
    PROMO_RATE: 0.05
  };

  /**
   * Calcule le prix GED pour une session
   *
   * @param ufovalPrice - Prix de base UFOVAL
   * @param duration - Durée en jours
   * @param departureCity - Ville de départ
   * @param promo - Appliquer promo (défaut: true)
   * @returns Prix final GED
   */
  static calculate(
    ufovalPrice: number,
    duration: GedDuration,
    departureCity: string = '',
    promo: boolean = true
  ): number {
    let price = ufovalPrice;

    // 1. Surcoût durée
    if (duration === 7) {
      price += this.CONFIG.DURATION_SURCHARGE[7];
    } else if (duration === 14) {
      price += this.CONFIG.DURATION_SURCHARGE[14];
    } else if (duration === 21) {
      price += this.CONFIG.DURATION_SURCHARGE[21];
    } else if (this.CONFIG.PRORATA_DURATIONS.includes(duration)) {
      // Proratisation (référence 14j)
      const refDuration = 14;
      const refSurcharge = this.CONFIG.DURATION_SURCHARGE[refDuration];
      const prorata = Math.round((refSurcharge / refDuration) * duration);
      price += prorata;
    }

    // 2. Supplément ville (si ville GED)
    if (this.CONFIG.DEPARTURE_CITIES.includes(departureCity.toLowerCase() as GedDepartureCity)) {
      price += this.CONFIG.DEPARTURE_SUPPLEMENT;
    }

    // 3. Promo
    if (promo) {
      price = Math.round(price * (1 - this.CONFIG.PROMO_RATE));
    }

    return price;
  }

  /**
   * Calcule le surcoût durée seulement
   */
  static getDurationSurcharge(duration: GedDuration): number {
    if (duration === 7) return this.CONFIG.DURATION_SURCHARGE[7];
    if (duration === 14) return this.CONFIG.DURATION_SURCHARGE[14];
    if (duration === 21) return this.CONFIG.DURATION_SURCHARGE[21];
    if (this.CONFIG.PRORATA_DURATIONS.includes(duration)) {
      const refDuration = 14;
      const refSurcharge = this.CONFIG.DURATION_SURCHARGE[refDuration];
      return Math.round((refSurcharge / refDuration) * duration);
    }
    return 0;
  }

  /**
   * Vérifie si une ville est une ville de départ GED
   */
  static isGedDepartureCity(city: string): boolean {
    return this.CONFIG.DEPARTURE_CITIES.includes(city.toLowerCase() as GedDepartureCity);
  }

  /**
   * Retourne la liste des villes de départ GED
   */
  static getDepartureCities(): GedDepartureCity[] {
    return this.CONFIG.DEPARTURE_CITIES;
  }

  /**
   * Calcule la durée entre deux dates
   */
  static calculateDuration(startDate: Date, endDate: Date): number {
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Formate un prix en euros
   */
  static formatPrice(price: number): string {
    return `${price.toLocaleString('fr-FR')} €`;
  }
}

/**
 * Fonction helper pour calculer le prix GED
 *
 * @example
 * const price = calculateGedPrice(615, 7, 'paris');
 * // returns: 767 (615 + 180 + 12, puis -5%)
 */
export function calculateGedPrice(
  ufovalPrice: number,
  duration: GedDuration,
  departureCity: string = '',
  promo: boolean = true
): number {
  return GedPricing.calculate(ufovalPrice, duration, departureCity, promo);
}

/**
 * Helper pour vérifier si une ville est une ville GED
 */
export function isGedCity(city: string): boolean {
  return GedPricing.isGedDepartureCity(city);
}

// ============================================================
// NOUVEAU: Fonction centralisée de calcul prix pour l'UI
// Utilisée par: stay-detail.tsx, booking-modal.tsx
// ============================================================

export type EducationalOptionType = 'ZEN' | 'ULTIME' | null;

export interface PriceBreakdown {
  baseSession: number | null;   // Prix de base session sélectionnée
  extraTransport: number;       // Surcoût ville départ
  extraOption: number;          // Option éducative (ZEN 49€ / ULTIME 79€)
  total: number | null;         // Total estimé (null si pas de session)
  minPrice: number | null;      // Prix minimum "À partir de" (session la moins chère + sans transport)
  hasSelection: boolean;        // Y a-t-il au moins une sélection ?
}

export interface PriceBreakdownParams {
  /** Prix de la session sélectionnée (null si aucune) */
  sessionPrice: number | null;
  /** Surcoût transport de la ville sélectionnée */
  cityExtraEur: number;
  /** Option éducative sélectionnée */
  optionType: EducationalOptionType;
  /** Prix minimum disponible (session la moins chère) */
  minSessionPrice: number | null;
}

/** Prix des options éducatives */
export const EDUCATIONAL_OPTIONS = {
  ZEN: { label: 'Option ZEN', price: 49, description: 'Suivi personnalisé' },
  ULTIME: { label: 'Option ULTIME', price: 79, description: 'Accompagnement renforcé 1+1' },
} as const;

/**
 * Calcule le breakdown de prix pour l'affichage UI
 *
 * @example
 * const breakdown = getPriceBreakdown({
 *   sessionPrice: 718,
 *   cityExtraEur: 220,
 *   optionType: 'ZEN',
 *   minSessionPrice: 718
 * });
 * // => { baseSession: 718, extraTransport: 220, extraOption: 49, total: 987, minPrice: 718, hasSelection: true }
 */
export function getPriceBreakdown(params: PriceBreakdownParams): PriceBreakdown {
  const { sessionPrice, cityExtraEur, optionType, minSessionPrice } = params;

  const extraOption = optionType === 'ZEN'
    ? EDUCATIONAL_OPTIONS.ZEN.price
    : optionType === 'ULTIME'
    ? EDUCATIONAL_OPTIONS.ULTIME.price
    : 0;

  const hasSelection = sessionPrice !== null || cityExtraEur > 0 || optionType !== null;

  const total = sessionPrice !== null
    ? sessionPrice + cityExtraEur + extraOption
    : null;

  return {
    baseSession: sessionPrice,
    extraTransport: cityExtraEur,
    extraOption,
    total,
    minPrice: minSessionPrice,
    hasSelection,
  };
}

/**
 * Formate un breakdown de prix pour l'affichage
 */
export function formatPriceBreakdown(breakdown: PriceBreakdown): {
  minPriceText: string;
  estimationText: string | null;
  detailLines: string[];
} {
  const minPriceText = breakdown.minPrice !== null
    ? `À partir de ${breakdown.minPrice} €`
    : 'Tarif sur demande';

  const estimationText = breakdown.total !== null && breakdown.hasSelection
    ? `${breakdown.total} €`
    : null;

  const detailLines: string[] = [];
  if (breakdown.baseSession !== null) {
    detailLines.push(`Session : ${breakdown.baseSession} €`);
  }
  if (breakdown.extraTransport > 0) {
    detailLines.push(`Transport : +${breakdown.extraTransport} €`);
  }
  if (breakdown.extraOption > 0) {
    detailLines.push(`Option : +${breakdown.extraOption} €`);
  }

  return { minPriceText, estimationText, detailLines };
}
