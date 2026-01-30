import crypto from 'crypto';

/**
 * Vérifier la signature d'un webhook n8n
 */
export function verifyWebhookSignature(signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}
