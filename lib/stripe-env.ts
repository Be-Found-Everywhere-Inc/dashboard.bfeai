/**
 * Stripe environment variable resolver.
 *
 * When `STRIPE_TEST_MODE=true`, reads from `<name>_TEST` env vars instead of
 * the live ones. This lets you keep both live and test Stripe keys configured
 * in Netlify and toggle between them with a single env var.
 *
 * Example:
 *   STRIPE_SECRET_KEY=sk_live_xxx        (live)
 *   STRIPE_SECRET_KEY_TEST=sk_test_yyy   (test)
 *   STRIPE_TEST_MODE=true                → uses sk_test_yyy
 */

const isTestMode = process.env.STRIPE_TEST_MODE === "true";

/**
 * Returns the value of a Stripe env var, respecting test mode.
 * When STRIPE_TEST_MODE=true, looks up `<name>_TEST` first.
 * Falls back to the live key if the _TEST variant is not set.
 */
export function getStripeEnv(name: string, fallback = ""): string {
  if (isTestMode) {
    return process.env[`${name}_TEST`] ?? process.env[name] ?? fallback;
  }
  return process.env[name] ?? fallback;
}
