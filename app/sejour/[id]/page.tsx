import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { StayDetail } from './stay-detail';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const stays = await prisma.stay.findMany({
    where: { published: true },
    select: { id: true },
  });
  return stays.map((s) => ({ id: s.id }));
}

export default async function StayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const stay = await prisma.stay.findUnique({
    where: { id },
    include: {
      sessions: {
        where: { startDate: { gte: new Date() } },
        orderBy: { startDate: 'asc' },
      },
    },
  });

  if (!stay || !stay.published) notFound();

  // Prix exclus du SSR (sécurité : visible uniquement pour pro authentifié)
  const stayData = {
    id: stay.id,
    slug: stay.slug,
    title: stay.title,
    descriptionShort: stay.descriptionShort,
    programme: stay.programme as string[],
    geography: stay.geography,
    accommodation: stay.accommodation,
    supervision: stay.supervision,
    durationDays: stay.durationDays,
    period: stay.period,
    ageMin: stay.ageMin,
    ageMax: stay.ageMax,
    themes: stay.themes as string[],
    imageCover: stay.imageCover,
    published: stay.published,
    createdAt: stay.createdAt.toISOString(),
    updatedAt: stay.updatedAt.toISOString(),

    // Champs UFOVAL / enrichissements (compat safe)
    departureCity: (stay as any).departureCity || null,
    educationalOption: (stay as any).educationalOption || null,

    // PDF (sourcePdfPath côté DB -> pdfUrl côté UI)
    pdfUrl: (stay as any).sourcePdfPath || null,

    price_base: stay.priceFrom,
    price_unit: '€',
    pro_price_note: stay.priceFrom ? undefined : 'Tarif communiqué aux professionnels',

    sessions: stay.sessions.map((s) => ({
      id: s.id,
      stayId: s.stayId,
      startDate: s.startDate.toISOString(),
      endDate: s.endDate.toISOString(),
      seatsLeft: s.seatsLeft,
    })),
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <StayDetail stay={stayData} />
      <BottomNav />
    </div>
  );
}
