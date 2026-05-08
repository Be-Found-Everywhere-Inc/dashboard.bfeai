import type { Metadata } from 'next';
import { CreditsPage } from './CreditsPage';
import { getAuthenticatedUser } from '@/lib/bfeai-auth/server';
import { isAutoTopUpBetaUser } from '@/lib/feature-flags';

export const metadata: Metadata = {
  title: 'Credits',
};

export default async function Page() {
  // Decode JWT server-side so the beta gate never leaks to the client.
  // getAuthenticatedUser reads the bfeai_session cookie — same pattern
  // used in layout.tsx. If null (edge case — middleware already guards this
  // route), CreditsPage renders without the auto-topup section.
  const user = await getAuthenticatedUser();
  const isBetaUser = user ? isAutoTopUpBetaUser(user.userId) : false;

  return <CreditsPage isBetaUser={isBetaUser} />;
}
