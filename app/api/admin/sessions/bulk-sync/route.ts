import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';

/**
 * POST /api/admin/sessions/bulk-sync
 * Synchroniser en masse les sessions UFOVAL avec la base de données
 */
export async function POST(request: NextRequest) {
  const auth = verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentification requise' } },
      { status: 401 }
    );
  }

  if (auth.role !== 'ADMIN') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Accès réservé aux administrateurs' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { sessions, source_url } = body;

    if (!sessions || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Sessions requises (array)' } },
        { status: 400 }
      );
    }

    if (!source_url) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'source_url requis' } },
        { status: 400 }
      );
    }

    // Trouver le séjour correspondant
    const stay = await prisma.stay.findFirst({
      where: {
        sourceUrl: {
          equals: source_url,
          mode: 'insensitive'
        }
      }
    });

    if (!stay) {
      return NextResponse.json(
        { error: { code: 'STAY_NOT_FOUND', message: 'Séjour non trouvé pour cette source URL' } },
        { status: 404 }
      );
    }

    // Supprimer les anciennes sessions pour ce séjour
    await prisma.staySession.deleteMany({
      where: { stayId: stay.id }
    });

    // Créer les nouvelles sessions
    const createdSessions = await Promise.all(
      sessions.map(async (session: any) => {
        return await prisma.staySession.create({
          data: {
            stayId: stay.id,
            startDate: new Date(session.start_date),
            endDate: new Date(session.end_date),
            basePrice: session.base_price_eur || 0,
            promoPrice: session.promo_price_eur || null,
            seats: 20, // Valeur par défaut, à ajuster selon scraping
            availableSeats: 20 // Valeur par défaut
          }
        });
      })
    );

    return NextResponse.json({
      data: {
        stay_id: stay.id,
        sessions_created: createdSessions.length,
        sessions: createdSessions
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error bulk syncing sessions:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur lors de la synchronisation des sessions' } },
      { status: 500 }
    );
  }
}
