import type { Metadata } from 'next';
import DeleteAccountPageClient from './DeleteAccountPage';

export const metadata: Metadata = { title: 'Delete Account' };

export default function Page() {
  return <DeleteAccountPageClient />;
}
