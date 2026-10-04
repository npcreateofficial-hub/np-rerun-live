import { AccountManagePageClient } from '@/components/accounts/AccountManagePageClient';

export default async function AccountManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountManagePageClient id={id} />;
}
