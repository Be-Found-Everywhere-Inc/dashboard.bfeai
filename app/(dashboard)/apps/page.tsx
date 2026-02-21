import type { Metadata } from 'next';
import { AppsPage } from './AppsPage';

export const metadata: Metadata = {
  title: 'Explore Apps',
};

export default function Page() {
  return <AppsPage />;
}
