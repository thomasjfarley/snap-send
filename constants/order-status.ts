import type { Postcard } from '@/lib/database.types';

export const POSTCARD_STATUS_STEPS: Postcard['status'][] = [
  'submitted',
  'in_transit',
  'processed_for_delivery',
  'delivered',
];

export const POSTCARD_STATUS_INFO: Record<
  Postcard['status'],
  { label: string; color: string; bg: string; emoji: string; desc: string }
> = {
  pending: {
    label: 'Pending', color: '#92400E', bg: '#FEF3C7', emoji: '⏳',
    desc: 'Awaiting payment confirmation.',
  },
  paid: {
    label: 'Paid', color: '#1E40AF', bg: '#DBEAFE', emoji: '💳',
    desc: 'Payment confirmed.',
  },
  submitted: {
    label: 'Printing', color: '#6B21A8', bg: '#F3E8FF', emoji: '🖨️',
    desc: 'Your postcard has been received and is being printed.',
  },
  mailed: {
    label: 'In Transit', color: '#1D4ED8', bg: '#DBEAFE', emoji: '✈️',
    desc: 'Your postcard is moving through the postal network.',
  },
  in_transit: {
    label: 'In Transit', color: '#1D4ED8', bg: '#DBEAFE', emoji: '✈️',
    desc: 'Your postcard is moving through the postal network.',
  },
  processed_for_delivery: {
    label: 'Processed for Delivery', color: '#166534', bg: '#DCFCE7', emoji: '📬',
    desc: 'Your postcard has reached the local delivery facility.',
  },
  delivered: {
    label: 'Delivered', color: '#14532D', bg: '#DCFCE7', emoji: '✅',
    desc: 'Your postcard has been delivered.',
  },
  failed: {
    label: 'Failed', color: '#991B1B', bg: '#FEE2E2', emoji: '❌',
    desc: 'Something went wrong with this order.',
  },
};

