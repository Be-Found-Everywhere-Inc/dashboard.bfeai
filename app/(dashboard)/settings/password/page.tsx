import type { Metadata } from 'next';
import ChangePasswordPageClient from './ChangePasswordPage';

export const metadata: Metadata = { title: 'Change Password' };

export default function Page() {
  return <ChangePasswordPageClient />;
}
