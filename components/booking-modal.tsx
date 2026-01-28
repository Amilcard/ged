'use client';

import { useState } from 'react';
import { X, Check, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import type { Stay, StaySession } from '@/lib/types';
import { formatDate, formatDateLong } from '@/lib/utils';

interface BookingModalProps {
  stay: Stay;
  sessions: StaySession[];
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
  childBirthYear: string;
  consent: boolean;
}

export function BookingModal({ stay, sessions, onClose }: BookingModalProps) {
  const [step, setStep] = useState(0); // 0 = session select, 1 = pro info, 2 = child info, 3 = success
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [showAllSessions, setShowAllSessions] = useState(false);

  const [step1, setStep1] = useState<Step1Data>({
    organisation: '',
    socialWorkerName: '',
    email: '',
    phone: '',
  });

  const [step2, setStep2] = useState<Step2Data>({
    childFirstName: '',
    childBirthYear: '',
    consent: false,
  });

  const validSessions = sessions?.filter(s => (s?.seatsLeft ?? 0) > 0) ?? [];
  // Supprimer les doublons stricts (même startDate ET même endDate)
  const sessionsUnique = (sessions || []).filter((s, idx, arr) => {
    const key = `${s.startDate}-${s.endDate}`;
    return idx === arr.findIndex(x => `${x.startDate}-${x.endDate}` === key);
  });
  const selectedSession = sessions?.find(s => s?.id === selectedSessionId);

  const isStep1Valid = step1.organisation && step1.socialWorkerName && step1.email && step1.phone;
  const isStep2Valid = step2.childFirstName && step2.childBirthYear && step2.consent;

  // Générer les années de naissance possibles (6-17 ans)
  const currentYear = new Date().getFullYear();
  const birthYears = Array.from({ length: 12 }, (_, i) => currentYear - 6 - i);

  const handleSubmit = async () => {
    if (!selectedSessionId) return;
    setLoading(true);
    setError('');

    try {
      // Convertir année en date (1er janvier de l'année pour compatibilité DB)
      const birthDate = `${step2.childBirthYear}-01-01`;
      
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stayId: stay?.id,
          sessionId: selectedSessionId,
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
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-primary-100 p-4 flex items-center justify-between">
          <h2 className="font-semibold text-primary text-lg">Réserver - {stay?.title ?? ''}</h2>
          <button onClick={onClose} className="p-1 hover:bg-primary-50 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Progress */}
          {step < 3 && (
            <div className="flex gap-2 mb-6">
              {[0, 1, 2].map(i => (
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
                  return (
                    <label
                      key={session?.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedSessionId === session?.id
                          ? 'border-accent bg-accent/5'
                          : isFull
                          ? 'border-primary-100 bg-primary-50 opacity-50 cursor-not-allowed'
                          : 'border-primary-100 hover:border-primary-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="session"
                        value={session?.id}
                        checked={selectedSessionId === session?.id}
                        onChange={e => !isFull && setSelectedSessionId(e.target.value)}
                        disabled={isFull}
                        className="w-4 h-4 text-accent"
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
              <button
                onClick={() => setStep(1)}
                disabled={!selectedSessionId}
                className="w-full py-3 bg-accent text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuer <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Pro Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">Informations du travailleur social</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Organisation *"
                  value={step1.organisation}
                  onChange={e => setStep1({ ...step1, organisation: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Nom complet *"
                  value={step1.socialWorkerName}
                  onChange={e => setStep1({ ...step1, socialWorkerName: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={step1.email}
                  onChange={e => setStep1({ ...step1, email: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <input
                  type="tel"
                  placeholder="Téléphone *"
                  value={step1.phone}
                  onChange={e => setStep1({ ...step1, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid}
                  className="flex-1 py-3 bg-accent text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Child Info (données minimisées) */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-medium text-primary">Informations de l&apos;enfant</h3>
              <p className="text-sm text-primary-500">Collecte minimale pour la pré-inscription</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Prénom de l'enfant *"
                  value={step2.childFirstName}
                  onChange={e => setStep2({ ...step2, childFirstName: e.target.value })}
                  className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <div>
                  <label className="text-sm text-primary-600 mb-1 block">Année de naissance *</label>
                  <select
                    value={step2.childBirthYear}
                    onChange={e => setStep2({ ...step2, childBirthYear: e.target.value })}
                    className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent bg-white"
                  >
                    <option value="">Sélectionner l&apos;année</option>
                    {birthYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-start gap-3 p-3 bg-primary-50 rounded-lg cursor-pointer">
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
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-primary-200 text-primary rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Retour
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!isStep2Valid || loading}
                  className="flex-1 py-3 bg-accent text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {loading ? 'Envoi...' : 'Confirmer'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-primary mb-2">Réservation confirmée !</h3>
              <p className="text-primary-600 mb-4">
                Votre demande pour <strong>{stay?.title}</strong> a été enregistrée.
              </p>
              <div className="bg-primary-50 p-4 rounded-lg text-left text-sm space-y-1">
                <p><strong>Référence :</strong> {bookingId}</p>
                <p><strong>Session :</strong> {formatDateLong(selectedSession?.startDate ?? '')} - {formatDateLong(selectedSession?.endDate ?? '')}</p>
                <p><strong>Enfant :</strong> {step2.childFirstName} (né en {step2.childBirthYear})</p>
                <p><strong>Contact :</strong> {step1.email}</p>
              </div>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
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
