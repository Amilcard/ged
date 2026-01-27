import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const stay = await prisma.stay.findUnique({
      where: { slug },
      include: {
        sessions: {
          where: { startDate: { gte: new Date() } },
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!stay || !stay.published) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Séjour non trouvé' } },
        { status: 404 }
      );
    }

    // Prix exclus pour endpoint public (sécurité)
    return NextResponse.json({
      id: stay.id,
      slug: stay.slug,
      sourceUrl: stay.sourceUrl,
      title: stay.title,
      descriptionShort: stay.descriptionShort,
      programme: stay.programme,
      geography: stay.geography,
      accommodation: stay.accommodation,
      supervision: stay.supervision,
      durationDays: stay.durationDays,
      period: stay.period,
      ageMin: stay.ageMin,
      ageMax: stay.ageMax,
      themes: stay.themes,
      imageCover: stay.imageCover,
      sessions: stay.sessions.map(s => ({
        id: s.id,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
        seatsLeft: s.seatsLeft,
      })),
    });
  } catch (error) {
    console.error('GET /api/stays/[slug] error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur' } },
      { status: 500 }
    );
  }
}
