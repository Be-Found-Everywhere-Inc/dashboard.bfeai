import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@bfeai/ui/components/card';

export const metadata: Metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background-secondary to-background-tertiary py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-200 [mask-image:radial-gradient(white,transparent_85%)] pointer-events-none" />

      <Card className="w-full max-w-2xl relative backdrop-blur-sm bg-background/95">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Terms of Service
          </CardTitle>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
            Last updated: February 2026
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-foreground">1. Introduction</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Welcome to BFEAI (Be Found Everywhere AI). By accessing or using our services, you agree to be bound by these Terms of Service. Please read them carefully before using our platform.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">2. Eligibility</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              You must be at least 18 years old to create an account or use BFEAI services. By creating an account, you represent and warrant that you are at least 18 years of age. If we learn that a user is under 18, we will promptly terminate their account.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">3. Account Terms</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">4. Acceptable Use</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              You agree to use BFEAI services only for lawful purposes. You may not use our services to engage in any activity that violates applicable laws or regulations, or that infringes on the rights of others.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">5. Payment Terms</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Paid subscriptions are billed in advance on a recurring basis. You authorize us to charge your payment method for all fees incurred. Refunds are handled in accordance with our refund policy.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">6. Termination</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We may suspend or terminate your access to our services at any time for violations of these terms. You may also terminate your account at any time through your account settings.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">7. Disclaimer</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Our services are provided &quot;as is&quot; without warranties of any kind. We do not guarantee that our services will be uninterrupted, error-free, or that results obtained will be accurate or reliable.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">8. Contact</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at support@bfeai.com.
            </p>
          </section>

          <div className="pt-4 border-t border-border text-center">
            <Link
              href="/signup"
              className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              Back to Sign Up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
