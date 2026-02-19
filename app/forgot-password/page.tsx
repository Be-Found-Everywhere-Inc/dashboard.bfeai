import type { Metadata } from 'next';
import ForgotPasswordPageClient from './ForgotPasswordPage';

export const metadata: Metadata = { title: 'Forgot Password' };

export default function Page() {
  return <ForgotPasswordPageClient />;
}
