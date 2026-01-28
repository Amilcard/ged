'use client';

import { useState } from 'react';
import { Heart, Share2, X, Compass, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { updateWishlistMotivation, canAddRequest } from '@/lib/utils';

interface WishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  stayTitle: string;
  staySlug: string;
  stayUrl: string;
}

export function WishlistModal({ isOpen, onClose, stayTitle, staySlug, stayUrl }: WishlistModalProps) {
  const [motivation, setMotivation] = useState('');
  const [prenom, setPrenom] = useState('');
  const [emailStructure, setEmailStructure] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [shareSuccess, setShareSuccess] = useState(false);
  const maxChars = 280;
  const emailLocked = process.env.NEXT_PUBLIC_EMAIL_STRUCTURE_LOCKED === 'true';
  const defaultEmail = process.env.NEXT_PUBLIC_DEFAULT_STRUCTURE_EMAIL || '';

  if (!isOpen) return null;

  const handleSaveMotivation = () => {
    const finalEmail = emailLocked ? defaultEmail : emailStructure;

    // Vérifier la limite de 3 demandes
    const check = canAddRequest(prenom.trim(), finalEmail);
    if (!check.allowed) {
      setError(check.message || 'Limite atteinte');
      return;
    }

    updateWishlistMotivation(staySlug, motivation.trim() || null, prenom.trim(), finalEmail);
    setSaved(true);
    setError('');
    setTimeout(() => setSaved(false), 1500);
  };

  const handleShare = async () => {
    const text = motivation.trim()
      ? `Ce séjour m'intéresse : ${stayTitle}\nPourquoi : ${motivation.trim()}\n${stayUrl}`
      : `Ce séjour m'intéresse : ${stayTitle}\n${stayUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: stayTitle, text });
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } catch {
        window.location.href = `mailto:?subject=${encodeURIComponent(`Ce séjour m'intéresse : ${stayTitle}`)}&body=${encodeURIComponent(text)}`;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-primary-50 hover:bg-primary-100 transition"
        >
          <X className="w-4 h-4 text-primary" />
        </button>

        {/* Success icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
            <Heart className="w-8 h-8 text-red-500 fill-current" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-primary text-center mb-1">
          Ajouté à Mes souhaits !
        </h2>
        <p className="text-sm text-primary-500 text-center mb-6">{stayTitle}</p>

        {/* Info message */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-primary">
            <span className="font-medium">Ton référent recevra ta demande.</span>
          </p>
        </div>

        {/* Prénom field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-primary mb-2">
            Ton prénom <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value.slice(0, 30))}
            placeholder="Ex: Alex"
            className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            required
          />
        </div>

        {/* Email structure field */}
        {!emailLocked && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-primary mb-2">
              Email de ta structure (référent)
            </label>
            <input
              type="email"
              value={emailStructure}
              onChange={(e) => setEmailStructure(e.target.value)}
              placeholder="Ex: referent@structure.fr"
              className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>
        )}

        {/* Motivation field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-primary mb-2">
            Pourquoi ce séjour t&apos;intéresse ? <span className="text-primary-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            value={motivation}
            onChange={(e) => setMotivation(e.target.value.slice(0, maxChars))}
            placeholder="Ex: avec qui tu veux partir, ce que tu veux découvrir, ce que tu veux apprendre, ce qui te fait envie…"
            className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            rows={3}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-primary-400">N'écris pas de nom de famille, d'adresse ou d'infos perso.</span>
            <span className="text-xs text-primary-400">{motivation.length}/{maxChars}</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Save button */}
        {prenom.trim() && (
          <button
            onClick={handleSaveMotivation}
            disabled={!prenom.trim()}
            className="w-full mb-4 py-3 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saved ? (
              <><Check className="w-4 h-4" /> Enregistré !</>
            ) : (
              'Enregistrer ma demande'
            )}
          </button>
        )}

        {/* Share success */}
        {shareSuccess && (
          <div className="mb-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm text-center">
            Copié dans le presse-papier !
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleShare}
            className="w-full py-3 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition"
          >
            <Share2 className="w-4 h-4" /> Partager
          </button>
          <Link
            href="/envies"
            className="w-full py-3 bg-primary-50 text-primary rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-100 transition"
          >
            <Heart className="w-4 h-4" /> Voir Mes souhaits
          </Link>
          <button
            onClick={onClose}
            className="w-full py-3 text-primary-500 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition"
          >
            <Compass className="w-4 h-4" /> Continuer à explorer
          </button>
        </div>
      </div>
    </div>
  );
}
