import type { Metadata } from 'next';
import ProfilePageClient from './ProfilePage';

export const metadata: Metadata = { title: 'Your Profile' };

export default function Page() {
  return <ProfilePageClient />;
}
