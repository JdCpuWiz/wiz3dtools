import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../../hooks/useProducts';
import { PageIcon } from '../common/PageIcon';

type FilterTab = 'all' | 'active' | 'inactive' | 'webstore';
type SortKey = 'name' | 'unitPrice' | 'unitsSold' | 'revenue';
type SortDir = 'asc' | 'desc';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'webstore', label: 'On Webstore' },
];

export const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const { products, isLoading, delete: deleteProduct, update, copy: copyProduct } = useProducts();

  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span style={{ color: '#ff9900' }}> ↕</span>;
    return <span style={{ color: '#ff9900' }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>;
  };

  const filtered = useMemo(() => {
    let list = [...products];

    if (filter === 'active') list = list.filter((p) => p.active);
    else if (filter === 'inactive') list = list.filter((p) => !p.active);
    else if (filter === 'webstore') list = list.filter((p) => p.publishedToStore);

    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (sortKey === 'unitPrice') { av = a.unitPrice; bv = b.unitPrice; }
      else if (sortKey === 'unitsSold') { av = a.unitsSold; bv = b.unitsSold; }
      else if (sortKey === 'revenue') { av = a.unitsSold * a.unitPrice; bv = b.unitsSold * b.unitPrice; }

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [products, filter, sortKey, sortDir]);

  const counts = useMemo(() => ({
    all: products.length,
    active: products.filter((p) => p.active).length,
    inactive: products.filter((p) => !p.active).length,
    webstore: products.filter((p) => p.publishedToStore).length,
  }), [products]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PageIcon src="/icons/products.png" alt="Products" />
          <h2 className="text-xl font-semibold text-iron-50">Products</h2>
        </div>
        <button onClick={() => navigate('/products/new')} className="btn-primary btn-sm">
          + New Product
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={filter === tab.key
              ? { background: '#ff9900', color: '#0a0a0a' }
              : { background: '#2d2d2d', color: '#d1d5db' }
            }
          >
            {tab.label}
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold"
              style={filter === tab.key
                ? { background: 'rgba(0,0,0,0.2)', color: '#0a0a0a' }
                : { background: '#3a3a3a', color: '#9ca3af' }
              }
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{ background: 'linear-gradient(to bottom, #3a3a3a, #2d2d2d)' }}
        >
          <p className="text-lg font-medium text-iron-50">No products match this filter</p>
        </div>
      ) : (
        <div className="card-surface">
          <table className="wiz-table">
            <thead>
              <tr>
                <th className="whitespace-nowrap">
                  <button onClick={() => handleSort('name')} className="hover:text-white transition-colors whitespace-nowrap">
                    Name{sortIcon('name')}
                  </button>
                </th>
                <th className="hidden sm:table-cell whitespace-nowrap">SKU</th>
                <th className="hidden sm:table-cell whitespace-nowrap">Description</th>
                <th className="whitespace-nowrap">
                  <button onClick={() => handleSort('unitPrice')} className="hover:text-white transition-colors whitespace-nowrap">
                    Unit Price{sortIcon('unitPrice')}
                  </button>
                </th>
                <th className="whitespace-nowrap">
                  <button onClick={() => handleSort('unitsSold')} className="hover:text-white transition-colors whitespace-nowrap">
                    Units Sold{sortIcon('unitsSold')}
                  </button>
                </th>
                <th className="hidden md:table-cell whitespace-nowrap">
                  <button onClick={() => handleSort('revenue')} className="hover:text-white transition-colors whitespace-nowrap">
                    Revenue{sortIcon('revenue')}
                  </button>
                </th>
                <th className="whitespace-nowrap">Status</th>
                <th className="hidden md:table-cell whitespace-nowrap">Webstore</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td className="font-medium text-white">{product.name}</td>
                  <td className="text-white hidden sm:table-cell font-mono text-xs whitespace-nowrap">{product.sku || '—'}</td>
                  <td className="text-white hidden sm:table-cell">
                    {product.description
                      ? product.description.length > 60
                        ? product.description.slice(0, 60) + '…'
                        : product.description
                      : '—'}
                  </td>
                  <td className="font-medium" style={{ color: '#ff9900' }}>
                    ${product.unitPrice.toFixed(2)}
                  </td>
                  <td className="text-white">{product.unitsSold}</td>
                  <td className="hidden md:table-cell font-medium" style={{ color: '#86efac' }}>
                    {product.unitsSold > 0 ? `$${(product.unitsSold * product.unitPrice).toFixed(2)}` : '—'}
                  </td>
                  <td>
                    <button
                      onClick={() => update(product.id, { active: !product.active })}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors"
                      style={product.active
                        ? { background: '#15803d', color: '#ffffff' }
                        : { background: '#6b7280', color: '#ffffff' }
                      }
                    >
                      {product.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="hidden md:table-cell">
                    <button
                      onClick={() => update(product.id, { publishedToStore: !product.publishedToStore })}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors"
                      style={product.publishedToStore
                        ? { background: '#1d4ed8', color: '#ffffff' }
                        : { background: '#4b5563', color: '#ffffff' }
                      }
                    >
                      {product.publishedToStore ? 'Live' : 'Off'}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="btn-secondary btn-sm text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const copy = await copyProduct(product.id);
                            navigate(`/products/${copy.id}`);
                          } catch {
                            // error toast handled in hook
                          }
                        }}
                        className="btn-secondary btn-sm text-xs"
                      >
                        Copy
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete product "${product.name}"?`)) return;
                          try {
                            await deleteProduct(product.id);
                          } catch (err: any) {
                            if (err.message?.includes('used in invoices')) {
                              if (confirm(`"${product.name}" is used in invoices and cannot be deleted.\n\nMark it as inactive instead?`)) {
                                update(product.id, { active: false });
                              }
                            }
                          }
                        }}
                        className="btn-danger btn-sm text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
