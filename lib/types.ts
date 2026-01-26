export interface Stay {
  id: string;
  slug: string;
  title: string;
  descriptionShort: string;
  programme: string[];
  geography: string;
  accommodation: string;
  supervision: string;
  priceFrom?: number; // Non exposé publiquement (sécurité)
  durationDays: number;
  period: string;
  ageMin: number;
  ageMax: number;
  themes: string[];
  imageCover: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  departureCity?: string | null; // Ville de départ (optionnel)
  educationalOption?: string | null; // Objectifs éducatifs (optionnel)
  sessions?: StaySession[];
  nextSessionStart?: string | null;
}

export interface StaySession {
  id: string;
  stayId: string;
  startDate: string;
  endDate: string;
  seatsTotal?: number; // Non exposé publiquement
  seatsLeft: number;
}

export interface Booking {
  id: string;
  stayId: string;
  sessionId: string;
  organisation: string;
  socialWorkerName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childLastName?: string; // Optionnel (minimisation données)
  childBirthDate?: string; // Optionnel
  childBirthYear?: number; // Année seulement (minimisation données mineur)
  notes?: string;
  childNotes?: string;
  consent: boolean;
  status: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
}

export type ViewMode = 'pro' | 'kids';
export type PeriodFilter = 'toutes' | 'printemps' | 'été';
