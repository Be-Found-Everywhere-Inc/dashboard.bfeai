import type { Metadata } from 'next';
import { BillingPage } from './BillingPage';

export const metadata: Metadata = {
  title: 'Billing & Invoices',
};

export default function Page() {
  return <BillingPage />;
}
