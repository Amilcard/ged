'use client';

import { useState } from 'react';
import { X, Check, ChevronRight, ChevronLeft, Loader2, Shield, Star } from 'lucide-react';
import type { Stay, StaySession } from '@/lib/types';
import { formatDate, formatDateLong, validateChildAge } from '@/lib/utils';

interface DepartureCity {
  city: string;
  extra_eur: number;
}

interface BookingModalProps {
  stay: Stay;
  sessions: StaySession[];
  departureCities?: DepartureCity[];
  sessionBasePrice?: number | null; // Prix de base de la session (pour calcul total)
  initialSessionId?: string; // Pré-sélection session depuis la page détail
  initialCity?: string; // Pré-sélection ville depuis la page détail
  onClose: () => void;
}

interface Step1Data {
  organisation: string;
  socialWorkerName: string;
  email: string;
  phone: string;
}

interface Step2Data {
  childFirstName: string;
  childBirthDate: string; // Format YYYY-MM-DD (input type="date")
  consent: boolean;
}

type EducationalOption = 'ZEN' | 'ULTIME' | null;

// Villes de départ standard (même liste pour tous les séjours)
const STANDARD_CITIES = [
  'Paris', 'Lyon', 'Lille', 'Marseille', 'Bordeaux', 'Rennes'
];

export function BookingModal({ stay, sessions, departureCities = [], sessionBasePrice = null, initialSessionId = '', initialCity = '', onClose }: BookingModalProps) {
  // Déterminer le step initial (si pré-sélections, on peut sauter des étapes)
  const getInitialStep = () => {
    if (initialSessionId && initialCity) return 2; // Session + Ville déjà choisis → step Pro
    if (initialSessionId) return 1; // Session choisie → step Ville
    return 0; // Rien de pré-sélectionné → step Session
  };
  const [step, setStep] = useState(getInitialStep); // 0 = session, 1 = ville, 2 = pro info, 3 = child info, 4 = validation, 5 = success
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId);
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedOption, setSelectedOption] = useState<EducationalOption>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [showAllSessions, setShowAllSessions] = useState(false);

  // Calcul du prix total dynamique (session + ville + option)
  const selectedCityData = departureCities.find(dc => dc.city === selectedCity);
  const extraVille = selectedCityData?.extra_eur ?? 0;
  const optionPrice = selectedOption === 'ZEN' ? 49 : selectedOption === 'ULTIME' ? 79 : 0;
  const totalPrice = sessionBasePrice !== null ? sessionBasePrice + extraVille + optionPrice : null;

  const [step1, setStep1] = useState<Step1Data>({
    organisation: '',
    socialWorkerName: '',
    email: '',
    phone: '',
  });

  const [step2, setStep2] = useState<Step2Data>({
    childFirstName: '',
    childBirthDate: '',
    consent: false,
  });

  const validSessions = sessions?.filter(s => (s?.seatsLeft ?? 0) > 0) ?? [];
  // Supprimer les doublons stricts (même startDate ET même endDate)
  const sessionsUnique = (sessions || []).filter((s, idx, arr) => {
    const key = `${s.startDate}-${s.endDate}`;
    return idx === arr.findIndex(x => `${x.startDate}-${x.endDate}` === key);
  });
  const selectedSession = sessions?.find(s => s?.id === selectedSessionId);

  // Validation de l'âge au jour près (à la date de début de session)
  const ageValidation = step2.childBirthDate && selectedSession
    ? validateChildAge(step2.childBirthDate, selectedSession.startDate, stay.ageMin, stay.ageMax)
    : { valid: false, age: null, message: null };

  // Filtrer les villes de départ : uniquement la liste standard + "Sans transport"
  const standardDepartureCities = departureCities.filter(dc =>
    STANDARD_CITIES.some(std =>
      dc.city.toLowerCase().includes(std.toLowerCase())
    ) || dc.city === 'Sans transport'
  );

  const isStep1Valid = step1.organisation && step1.socialWorkerName && step1.email && step1.phone;
  // Step2 valide si: prénom rempli, date de naissance valide, âge OK, consentement
  const isStep2Valid = step2.childFirstName && step2.childBirthDate && ageValidation.valid && step2.consent;

  const handleSubmit = async () => {
    if (!selectedSessionId) return;
    setLoading(true);
    setError('');

    try {
      // Date de naissance au format YYYY-MM-DD (déjà fournie par input type="date")
      const birthDate = step2.childBirthDate;

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stayId: stay?.id,
          sessionId: selectedSessionId,
          departureCity: selectedCity,
          educationalOption: selectedOption,
          ...step1,
          childFirstName: step2.childFirstName,
          childLastName: '', // Minimisation données
          childBirthDate: birthDate,
          consent: step2.consent,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Erreur lors de la réservation');

      setBookingId(data?.id ?? '');
      setStep(5);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  // Options éducatives
  const educationalOptions = [
    { code: 'ZEN' as const, label: 'Option Tranquillité', description: 'Renfort léger pour sécuriser le séjour', price: 49, color: 'green' },
    { code: 'ULTIME' as const, label: 'Option Ultime', description: 'Encadrement individualisé renforcé (1+1)', price: 79, color: 'purple' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-primary-100 p-6 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-primary text-lg">Réserver - {stay?.title ?? ''}</h2>
            <button onClick={onClose} className="p-1 hover:bg-primary-50 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Prix total dynamique (affiché dès qu'on a un prix de base) */}
          {totalPrice !== null && step < 5 && (
            <div className="mt-3 p-3 bg-accent/5 rounded-xl border border-accent/20 flex items-center justify-between">
              <div className="text-sm text-primary-600">
                <span className="font-medium">Total estimé</span>
                {extraVille > 0 && <span className="text-xs ml-2 text-primary-500">(+{extraVille}€ transport)</span>}
                {optionPrice > 0 && <span className="text-xs ml-2 text-primary-500">(+{optionPrice}€ option)</span>}
              </div>
              <div className="text-lg font-bold text-accent">{totalPrice} €</div>
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Progress */}
          {step < 5 && (
            <div className="flex gap-2 mb-6">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? 'bg-accent' : 'bg-primary-100'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Step 0: Session Selection */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">Choisir une session</h3>
              <div className="space-y-2">
                {sessionsUnique.slice(0, showAllSessions ? undefined : 4).map(session => {
                  const isFull = (session?.seatsLeft ?? 0) === 0;
                  const isSelected = selectedSessionId === session?.id;
                  return (
                    <label
                      key={session?.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                          : isFull
                          ? 'border-primary-100 bg-primary-50 opacity-50 cursor-not-allowed'
                          : 'border-primary-100 hover:border-primary-200'
                      }`}
                    >
                      {/* Indicateur checkbox/radio visible */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? 'border-accent bg-accent'
                          : isFull
                          ? 'border-primary-200 bg-primary-100'
                          : 'border-primary-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input
                        type="radio"
                        name="session"
                        value={session?.id}
                        checked={isSelected}
                        onChange={e => !isFull && setSelectedSessionId(e.target.value)}
                        disabled={isFull}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {formatDateLong(session?.startDate ?? '')} - {formatDateLong(session?.endDate ?? '')}
                        </div>
                        <div className={`text-xs ${isFull ? 'text-red-500' : 'text-primary-500'}`}>
                          {isFull ? 'Complet' : `${session?.seatsLeft ?? 0} places restantes`}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {sessionsUnique.length > 4 && !showAllSessions && (
                <button
                  onClick={() => setShowAllSessions(true)}
                  className="w-full py-2 text-sm text-accent hover:underline"
                >
                  Voir toutes les dates ({sessionsUnique.length - 4} autres)
                </button>
              )}
              {/* Aide contextuelle step 1 */}
              <div className="bg-primary-50 rounded-lg p-3 text-xs text-primary-600">
                <p><strong>1.</strong> Sélectionne la session qui correspond le mieux à tes disponibilités</p>
              </div>
              {!selectedSessionId && (
                <p className="text-sm text-amber-600 text-center">
                  ⚠ Sélectionnez une session pour continuer
                </p>
              )}
              <button
                onClick={() => setStep(1)}
                disabled={!selectedSessionId}
                className="w-full py-3 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuer <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Ville de départ */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">Ville de départ</h3>
              <p className="text-sm text-primary-500">Choisissez la ville de départ pour le transport</p>

              {standardDepartureCities && standardDepartureCities.length > 0 ? (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {standardDepartureCities
                    .slice()
                    .sort((a, b) => {
                      if (a.city === 'Sans transport') return -1;
                      if (b.city === 'Sans transport') return 1;
                      // Trier selon l'ordre de STANDARD_CITIES
                      const aIndex = STANDARD_CITIES.findIndex(std => a.city.toLowerCase().includes(std.toLowerCase()));
                      const bIndex = STANDARD_CITIES.findIndex(std => b.city.toLowerCase().includes(std.toLowerCase()));
                      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
                      if (aIndex >= 0) return -1;
                      if (bIndex >= 0) return 1;
                      return a.city.localeCompare(b.city);
                    })
                    .map((city, idx) => {
                      const isCitySelected = selectedCity === city.city;
                      return (
                        <label
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isCitySelected
                              ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                              : 'border-primary-200 hover:border-primary-300'
                          }`}
                        >
                          {/* Indicateur checkbox/radio visible */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isCitySelected
                              ? 'border-accent bg-accent'
                              : 'border-primary-300'
                          }`}>
                            {isCitySelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <input
                            type="radio"
                            name="city"
                            value={city.city}
                            checked={isCitySelected}
                            onChange={e => setSelectedCity(e.target.value)}
                            className="sr-only"
                          />
                          <span className="flex-1 text-sm font-medium text-primary-700 capitalize">
                            {city.city === 'Sans transport' ? 'Sans transport' : city.city}
                          </span>
                          <span className={`text-sm font-semibold ${isCitySelected ? 'text-accent' : 'text-primary-600'}`}>
                            {city.extra_eur === 0 ? 'Inclus' : `+${city.extra_eur}€`}
                          </span>
                        </label>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-primary-500 italic">Villes de départ non disponibles. Contactez-nous pour plus d'informations.</p>
              )}

              {/* Aide contextuelle */}
              <div className="bg-primary-50 rounded-lg p-3 text-xs text-primary-600">
                <p><strong>2.</strong> Choisis ta ville de départ — le total se met à jour automatiquement</p>
              </div>
              {!selectedCity && (
                <p className="text-sm text-amber-600 text-center">
                  ⚠ Sélectionnez une ville pour continuer
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedCity}
                  className="flex-1 py-3 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Pro Info (anciennement step 1) */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">Informations du travailleur social</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Organisation *"
                  value={step1.organisation}
                  onChange={e => setStep1({ ...step1, organisation: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Nom complet *"
                  value={step1.socialWorkerName}
                  onChange={e => setStep1({ ...step1, socialWorkerName: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={step1.email}
                  onChange={e => setStep1({ ...step1, email: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <input
                  type="tel"
                  placeholder="Téléphone *"
                  value={step1.phone}
                  onChange={e => setStep1({ ...step1, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!isStep1Valid}
                  className="flex-1 py-3 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Child Info (anciennement step 2) */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">Informations de l&apos;enfant</h3>
              <p className="text-sm text-primary-500">Collecte minimale pour la pré-inscription</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Prénom de l'enfant *"
                  value={step2.childFirstName}
                  onChange={e => setStep2({ ...step2, childFirstName: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <div>
                  <label className="text-sm text-primary-600 mb-1 block">Date de naissance *</label>
                  <input
                    type="date"
                    value={step2.childBirthDate}
                    onChange={e => setStep2({ ...step2, childBirthDate: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent bg-white ${
                      ageValidation.message ? 'border-red-300' : 'border-primary-200'
                    }`}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {!selectedSession && step2.childBirthDate && (
                    <p className="mt-1 text-sm text-amber-600">
                      ⚠ Veuillez d&apos;abord sélectionner une session pour valider l&apos;âge
                    </p>
                  )}
                  {ageValidation.message && (
                    <p className="mt-1 text-sm text-red-600">{ageValidation.message}</p>
                  )}
                  {ageValidation.valid && ageValidation.age !== null && (
                    <p className="mt-1 text-sm text-green-600">
                      ✓ L&apos;enfant aura {ageValidation.age} ans au départ ({stay.ageMin}–{stay.ageMax} ans requis)
                    </p>
                  )}
                </div>
                <label className="flex items-start gap-3 p-3 bg-primary-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step2.consent}
                    onChange={e => setStep2({ ...step2, consent: e.target.checked })}
                    className="w-5 h-5 mt-0.5 text-accent rounded"
                  />
                  <span className="text-sm text-primary-600">
                    J&apos;accepte les conditions générales et autorise le traitement des données *
                  </span>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!isStep2Valid}
                  className="flex-1 py-3 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Validation + Options éducatives */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">Validation de la réservation</h3>

              {/* Récapitulatif */}
              <div className="bg-primary-50 p-4 rounded-xl space-y-1">
                <p className="text-sm"><strong>Séjour :</strong> {stay?.title}</p>
                <p className="text-sm"><strong>Session :</strong> {formatDateLong(selectedSession?.startDate ?? '')}</p>
                <p className="text-sm"><strong>Ville :</strong> {selectedCity}</p>
                <p className="text-sm"><strong>Enfant :</strong> {step2.childFirstName} ({ageValidation.age} ans au départ)</p>
              </div>

              {/* Options éducatives */}
              <div>
                <h4 className="text-sm font-medium text-primary mb-2">
                  Options d'accompagnement (optionnel)
                </h4>
                <p className="text-xs text-primary-500 mb-3">
                  Renfort d'encadrement selon le profil du jeune
                </p>
                <div className="space-y-2">
                  {educationalOptions.map(option => (
                    <label
                      key={option.code}
                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedOption === option.code
                          ? 'border-accent bg-accent/5'
                          : 'border-primary-200 hover:border-primary-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="educationalOption"
                        value={option.code}
                        checked={selectedOption === option.code}
                        onChange={() => setSelectedOption(option.code)}
                        className="sr-only"
                      />
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          option.color === 'green' ? 'bg-green-100' : 'bg-purple-100'
                        }`}>
                          {option.code === 'ZEN' ? (
                            <Shield className="w-5 h-5 text-green-600" />
                          ) : (
                            <Star className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-primary text-sm">{option.label}</p>
                          <p className="text-xs text-primary-600">{option.description}</p>
                        </div>
                        <span className="text-sm font-semibold text-accent">+{option.price}€</span>
                      </div>
                    </label>
                  ))}
                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer ${
                      !selectedOption ? 'border-accent bg-accent/5' : 'border-primary-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="educationalOption"
                      value=""
                      checked={!selectedOption}
                      onChange={() => setSelectedOption(null)}
                      className="sr-only"
                    />
                    <span className="text-sm text-primary-600">Aucune option</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {loading ? 'Envoi...' : 'Confirmer'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Success (anciennement step 3) */}
          {step === 5 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Réservation confirmée !</h3>
              <p className="text-primary-600 mb-4">
                Votre demande pour <strong>{stay?.title}</strong> a été enregistrée.
              </p>
              <div className="bg-primary-50 p-4 rounded-xl text-left text-sm space-y-1">
                <p><strong>Référence :</strong> {bookingId}</p>
                <p><strong>Session :</strong> {formatDateLong(selectedSession?.startDate ?? '')} - {formatDateLong(selectedSession?.endDate ?? '')}</p>
                <p><strong>Ville :</strong> {selectedCity}</p>
                <p><strong>Enfant :</strong> {step2.childFirstName} (né le {formatDate(step2.childBirthDate)})</p>
                <p><strong>Contact :</strong> {step1.email}</p>
                {selectedOption && (
                  <p><strong>Option :</strong> {selectedOption === 'ZEN' ? 'Option Tranquillité' : 'Option Ultime'}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-600 transition-colors"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
