import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumb({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
            {index > 0 && <ChevronRight size={14} style={{ margin: '0 0.25rem', opacity: 0.7 }} />}
            
            {!isLast && item.path ? (
              <Link 
                to={item.path} 
                style={{ 
                  color: 'var(--accent-primary)', 
                  textDecoration: 'none',
                  fontWeight: 500
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
