import { prisma } from '@/lib/db';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { HomeContent } from '../home-content';

export const dynamic = 'force-dynamic';

export default async function SejoursPage() {
  const stays = await prisma.stay.findMany({
    where: { published: true },
    include: {
      sessions: {
        where: { startDate: { gte: new Date() } },
        orderBy: { startDate: 'asc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Prix exclus du SSR (sécurité : visible uniquement pour pro authentifié)
  const staysData = stays.map(stay => ({
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
    nextSessionStart: stay.sessions[0]?.startDate?.toISOString() ?? null,
  }));

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <HomeContent stays={staysData} />
      <BottomNav />
    </div>
  );
}