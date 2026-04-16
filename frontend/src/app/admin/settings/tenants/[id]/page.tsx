import { redirect } from 'next/navigation';

export default function Page({ params: _params }: { params: Promise<{ id: string }> }) {
  // Cannot use await in server redirect, use simple redirect
  redirect('/platform/tenants');
}
