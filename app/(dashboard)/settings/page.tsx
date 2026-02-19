import type { Metadata } from 'next';
import SettingsPageClient from './SettingsPage';

export const metadata: Metadata = { title: 'Account Settings' };

export default function Page() {
  return <SettingsPageClient />;
}
