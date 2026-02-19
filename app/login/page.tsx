import type { Metadata } from 'next';
import LoginPageClient from './LoginPage';

export const metadata: Metadata = { title: 'Sign In' };

export default function Page() {
  return <LoginPageClient />;
}
