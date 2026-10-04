export type NotificationItem = {
  id: string;
  userId: string | null;
  title: string;
  message: string;
  imageUrl: string | null;
  styleJson: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | string;
  status: 'SENT' | 'DRAFT' | 'ARCHIVED' | string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
};
