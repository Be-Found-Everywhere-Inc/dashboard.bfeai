import type { Metadata } from 'next';
import { CreditsPage } from './CreditsPage';

export const metadata: Metadata = {
  title: 'Credits',
};

export default function Page() {
  return <CreditsPage />;
}
