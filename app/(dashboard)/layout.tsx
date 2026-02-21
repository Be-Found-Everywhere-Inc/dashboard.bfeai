import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('bfeai_session')?.value;

  if (!token) {
    redirect('/login');
  }

  // Basic JWT validation (expiration check)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) redirect('/login');
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString()
    );
    if (payload.exp * 1000 < Date.now()) redirect('/login');
  } catch {
    redirect('/login');
  }

  return <DashboardShell>{children}</DashboardShell>;
}
