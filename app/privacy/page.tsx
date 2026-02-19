import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@bfeai/ui/components/card';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background-secondary to-background-tertiary py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-200 [mask-image:radial-gradient(white,transparent_85%)] pointer-events-none" />

      <Card className="w-full max-w-2xl relative backdrop-blur-sm bg-background/95">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Privacy Policy
          </CardTitle>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
            Last updated: February 2026
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-foreground">1. Introduction</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              BFEAI (Be Found Everywhere AI) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our services.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">2. Information We Collect</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We collect information you provide directly, such as your name, email address, and company details. We also collect usage data including keyword searches, report generation activity, and general platform interactions.
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
              During registration, we collect your confirmation that you are at least 18 years old. We log the timestamp and associated network information of this confirmation for compliance purposes.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">3. How We Use Your Information</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We use your information to provide and improve our services, process transactions, send service-related communications, and ensure the security of your account.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">4. Data Sharing</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We do not sell your personal information. We may share data with third-party service providers who assist in operating our platform, subject to confidentiality obligations.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">5. Security</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We implement industry-standard security measures including encryption, rate limiting, and access controls to protect your data. However, no method of transmission over the internet is completely secure.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">6. Cookies</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We use essential cookies for authentication and session management across our platform. These cookies are necessary for the service to function and cannot be disabled.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">7. Your Rights</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              You have the right to access, update, or delete your personal information at any time. Specifically:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-2 space-y-1">
              <li><strong>Access &amp; portability:</strong> Download a complete copy of your data in JSON format from your <Link href="/settings" className="text-primary hover:text-primary-hover underline">account settings</Link> page.</li>
              <li><strong>Correction:</strong> Update your profile information, company, and preferences from your <Link href="/settings" className="text-primary hover:text-primary-hover underline">account settings</Link>.</li>
              <li><strong>Deletion:</strong> Permanently delete your account and all associated data from <Link href="/settings/delete" className="text-primary hover:text-primary-hover underline">account settings</Link>. This action is immediate and irreversible.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">8. Changes to This Policy</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page with a revised date.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">9. Contact</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at support@bfeai.com.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground">10. Data Retention &amp; Deletion</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              When you delete your account, the following actions occur immediately and permanently:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-2 space-y-1">
              <li>Your authentication account and profile are permanently deleted.</li>
              <li>All active subscriptions are cancelled in Stripe immediately.</li>
              <li>Files you uploaded (avatars, screenshots, logos) are deleted from storage.</li>
              <li>Your keyword reports, credit history, and app data are permanently removed.</li>
              <li>Anonymized audit logs (with no personally identifiable information) may be retained for security analytics and fraud prevention.</li>
            </ul>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
              Age confirmation records are retained in anonymized form for legal compliance even after account deletion.
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
              Account deletion is immediate with no grace period. This action cannot be undone.
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
