import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import type { Listing } from '../types';
import { CardItem } from './CardItem';
import { CardSkeleton } from './LoadingSpinner';

interface Props {
  listings?: Listing[];
  loading?: boolean;
  emptyText?: string;
  emptySubText?: string;
  emptyIcon?: ReactNode;
  limit?: number;
}

export function CardGrid({ listings, loading, emptyText = '沒有商品', emptySubText, emptyIcon = <Inbox size={36} color="#475569" />, limit }: Props) {
  const items = limit && listings ? listings.slice(0, limit) : listings;

  return (
    <div style={{
      display: 'grid',
      gap: 12,
      gridTemplateColumns: 'repeat(2, 1fr)',
    }} className="card-grid">
      {loading
        ? [0,1,2,3,4,5].map(i => <CardSkeleton key={i} />)
        : items?.length === 0
        ? (
          <div style={{
            gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0',
            borderRadius: 16, background: '#111124', border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ opacity: 0.2, marginBottom: 10, display: 'flex', justifyContent: 'center' }}>{emptyIcon}</div>
            <p style={{ color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>{emptyText}</p>
            {emptySubText && <p style={{ color: '#475569', fontSize: 13 }}>{emptySubText}</p>}
          </div>
        )
        : items?.map(l => <CardItem key={l.id} listing={l} />)
      }
    </div>
  );
}
