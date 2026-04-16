import PortalLayout from '@/components/portal/portal-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PortalLayout>{children}</PortalLayout>;
}
