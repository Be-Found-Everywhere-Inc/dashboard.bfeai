import { NextResponse } from 'next/server';

/**
 * Health check endpoint for monitoring
 * GET /api/health
 */
export async function GET() {
  const startTime = Date.now();

  const health = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'unknown',
    services: {
      database: 'unknown' as 'connected' | 'disconnected' | 'unknown',
      redis: 'unknown' as 'connected' | 'disabled' | 'unknown',
      recaptcha: 'unknown' as 'enabled' | 'disabled' | 'unknown',
    },
    latency: 0,
  };

  // Check database connection
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    health.services.database = error ? 'disconnected' : 'connected';
  } catch {
    health.services.database = 'disconnected';
    health.status = 'degraded';
  }

  // Check Redis (rate limiting)
  const isRedisConfigured =
    process.env.UPSTASH_REDIS_URL &&
    process.env.UPSTASH_REDIS_TOKEN &&
    process.env.UPSTASH_REDIS_URL.startsWith('https://');

  health.services.redis = isRedisConfigured ? 'connected' : 'disabled';

  // Check reCAPTCHA configuration
  const isRecaptchaConfigured =
    process.env.RECAPTCHA_SECRET_KEY &&
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY &&
    !process.env.RECAPTCHA_SECRET_KEY.includes('your_recaptcha');

  health.services.recaptcha = isRecaptchaConfigured ? 'enabled' : 'disabled';

  // Calculate latency
  health.latency = Date.now() - startTime;

  // Determine overall status
  if (health.services.database === 'disconnected') {
    health.status = 'unhealthy';
  } else if (health.services.redis === 'disabled') {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
