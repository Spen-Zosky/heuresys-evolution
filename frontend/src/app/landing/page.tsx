import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function LandingRedirect() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'it';
  redirect(`/${locale}/landing`);
}
