import type { Metadata } from 'next';
import SignupPageClient from './SignupPage';

export const metadata: Metadata = { title: 'Create Account' };

export default function Page() {
  return <SignupPageClient />;
}
