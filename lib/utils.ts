import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return dayjs(date).format('DD/MM/YYYY');
}

export function formatDateLong(date: string | Date): string {
  return dayjs(date).format('D MMMM YYYY');
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const STORAGE_KEYS = {
  MODE: 'gd_mode',
  AUTH: 'gd_auth',
  PERIOD: 'gd_period',
  WISHLIST: 'gd_kids_wishlist',
} as const;

// Kids wishlist with motivation + request data
export interface WishlistItem {
  stayId: string;
  addedAt: string;
  motivation: string | null;
  prenom?: string | null;
  emailStructure?: string | null;
}

export interface WishlistData {
  version: number;
  items: WishlistItem[];
}

function getWishlistData(): WishlistData {
  if (typeof window === 'undefined') return { version: 1, items: [] };
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.WISHLIST);
    if (!stored) return { version: 1, items: [] };
    const data = JSON.parse(stored);
    // Migration from old format (string[])
    if (Array.isArray(data)) {
      const migrated: WishlistData = {
        version: 1,
        items: data.map((slug: string) => ({ stayId: slug, addedAt: new Date().toISOString(), motivation: null }))
      };
      localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(migrated));
      return migrated;
    }
    return data as WishlistData;
  } catch {
    return { version: 1, items: [] };
  }
}

function saveWishlistData(data: WishlistData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(data));
}

export function getWishlist(): string[] {
  return getWishlistData().items.map(i => i.stayId);
}

export function getWishlistItems(): WishlistItem[] {
  return getWishlistData().items;
}

export function getWishlistMotivation(slug: string): string | null {
  const item = getWishlistData().items.find(i => i.stayId === slug);
  return item?.motivation ?? null;
}

export function addToWishlist(slug: string, motivation?: string | null): string[] {
  if (typeof window === 'undefined') return [];
  const data = getWishlistData();
  if (!data.items.find(i => i.stayId === slug)) {
    data.items.push({ stayId: slug, addedAt: new Date().toISOString(), motivation: motivation ?? null });
    saveWishlistData(data);
  }
  return data.items.map(i => i.stayId);
}

export function removeFromWishlist(slug: string): string[] {
  if (typeof window === 'undefined') return [];
  const data = getWishlistData();
  data.items = data.items.filter(i => i.stayId !== slug);
  saveWishlistData(data);
  return data.items.map(i => i.stayId);
}

export function updateWishlistMotivation(slug: string, motivation: string | null, prenom?: string | null, emailStructure?: string | null): void {
  if (typeof window === 'undefined') return;
  const data = getWishlistData();
  const item = data.items.find(i => i.stayId === slug);
  if (item) {
    item.motivation = motivation;
    if (prenom !== undefined) item.prenom = prenom;
    if (emailStructure !== undefined) item.emailStructure = emailStructure;
    saveWishlistData(data);
  }
}

// Check if user can add more requests (limit 3 per prenom+email in 30 days)
export function canAddRequest(prenom: string, emailStructure: string): { allowed: boolean; message?: string } {
  if (typeof window === 'undefined') return { allowed: true };

  const data = getWishlistData();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentRequests = data.items.filter(item => {
    const itemDate = new Date(item.addedAt);
    const matchesIdentity = item.prenom?.toLowerCase() === prenom.toLowerCase() &&
                           item.emailStructure?.toLowerCase() === emailStructure.toLowerCase();
    return matchesIdentity && itemDate >= thirtyDaysAgo;
  });

  if (recentRequests.length >= 3) {
    return {
      allowed: false,
      message: 'Tu as déjà envoyé 3 demandes. Demande à ton référent.'
    };
  }

  return { allowed: true };
}

export function toggleWishlist(slug: string): { wishlist: string[]; added: boolean } {
  const current = getWishlist();
  if (current.includes(slug)) {
    return { wishlist: removeFromWishlist(slug), added: false };
  }
  return { wishlist: addToWishlist(slug), added: true };
}

export function clearWishlist(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.WISHLIST);
}

export function getStoredMode(): 'pro' | 'kids' {
  if (typeof window === 'undefined') return 'pro';
  return (localStorage.getItem(STORAGE_KEYS.MODE) as 'pro' | 'kids') || 'pro';
}

export function setStoredMode(mode: 'pro' | 'kids'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.MODE, mode);
}

export function getStoredAuth(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.AUTH);
}

export function setStoredAuth(token: string): void {
  if (typeof window === 'undefined') return;
  if (!token || token.trim() === '') return;
  localStorage.setItem(STORAGE_KEYS.AUTH, token);
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.AUTH);
}

export function resetAllStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.MODE);
  localStorage.removeItem(STORAGE_KEYS.AUTH);
  localStorage.removeItem(STORAGE_KEYS.PERIOD);
}

// ============================================================
// VALIDATION ÂGE: Calcul exact à la date de session
// ============================================================

/**
 * Calcule l'âge exact en années à une date donnée
 * @param birthDate - Date de naissance (format ISO ou YYYY-MM-DD)
 * @param targetDate - Date à laquelle calculer l'âge (ex: début de session)
 * @returns Âge en années (entier) ou null si dates invalides
 */
export function calculateAgeAtDate(birthDate: string, targetDate: string): number | null {
  const birth = dayjs(birthDate);
  const target = dayjs(targetDate);

  if (!birth.isValid() || !target.isValid()) return null;

  let age = target.year() - birth.year();

  // Ajuster si l'anniversaire n'est pas encore passé à la date cible
  const birthdayThisYear = birth.year(target.year());
  if (target.isBefore(birthdayThisYear)) {
    age -= 1;
  }

  return age;
}

export interface AgeValidationResult {
  valid: boolean;
  age: number | null;
  message: string | null;
}

/**
 * Valide si l'âge de l'enfant est dans les limites du séjour
 * @param birthDate - Date de naissance (format YYYY-MM-DD)
 * @param sessionStartDate - Date de début de session (format ISO)
 * @param ageMin - Âge minimum requis
 * @param ageMax - Âge maximum autorisé
 * @returns Résultat de validation avec message
 */
export function validateChildAge(
  birthDate: string,
  sessionStartDate: string,
  ageMin: number,
  ageMax: number
): AgeValidationResult {
  if (!birthDate || !sessionStartDate) {
    return { valid: false, age: null, message: null };
  }

  const age = calculateAgeAtDate(birthDate, sessionStartDate);

  if (age === null) {
    return { valid: false, age: null, message: 'Date de naissance invalide' };
  }

  if (age < ageMin) {
    return {
      valid: false,
      age,
      message: `À la date du départ, l'enfant aura ${age} ans. Ce séjour est prévu pour les ${ageMin}–${ageMax} ans.`
    };
  }

  if (age > ageMax) {
    return {
      valid: false,
      age,
      message: `À la date du départ, l'enfant aura ${age} ans. Ce séjour est prévu pour les ${ageMin}–${ageMax} ans.`
    };
  }

  return { valid: true, age, message: null };
}
