import type { Metadata } from 'next';
import ResetPasswordPageClient from './ResetPasswordPage';

export const metadata: Metadata = { title: 'Set New Password' };

export default function Page() {
  return <ResetPasswordPageClient />;
}
