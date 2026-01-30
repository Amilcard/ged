import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/webhook-auth';

/**
 * POST /api/webhook/ufoval-scraper-complete
 * Webhook appelé par n8n lorsque le scraping est terminé
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier la signature du webhook (sécurité)
    const signature = request.headers.get('x-n8n-webhook-signature');
    if (!signature || !verifyWebhookSignature(signature, process.env.N8N_WEBHOOK_SECRET || 'secret')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Signature webhook invalide' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status, stays_processed, timestamp } = body;

    // Logger la completion
    console.log(`[UFOVAL Scraper] Scraping terminé: ${stays_processed} séjours traités à ${timestamp}`);

    // Ici, vous pouvez ajouter de la logique post-scraping :
    // - Envoyer une notification Slack/Email
    // - Mettre à jour un cache
    // - Déclencher d'autres workflows

    return NextResponse.json({
      success: true,
      message: 'Webhook reçu avec succès'
    }, { status: 200 });

  } catch (error) {
    console.error('Error handling webhook:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur lors du traitement du webhook' } },
      { status: 500 }
    );
  }
}
