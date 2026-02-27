import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../../hooks/useProducts';

export const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const { products, isLoading, delete: deleteProduct, update } = useProducts();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-iron-50">Products</h2>
        <button
          onClick={() => navigate('/products/new')}
          className="btn-primary btn-sm"
        >
          + New Product
        </button>
      </div>

      {products.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{ background: 'linear-gradient(to bottom, #3a3a3a, #2d2d2d)' }}
        >
          <p className="text-lg font-medium text-iron-50">No products yet</p>
          <p className="text-sm mt-1 text-iron-400">Create your first product to get started</p>
        </div>
      ) : (
        <div className="card-surface">
          <table className="wiz-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden sm:table-cell">SKU</th>
                <th className="hidden sm:table-cell">Description</th>
                <th>Unit Price</th>
                <th>Units Sold</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="font-medium text-iron-50">{product.name}</td>
                  <td className="text-iron-400 hidden sm:table-cell font-mono text-xs">{product.sku || '—'}</td>
                  <td className="text-iron-400 hidden sm:table-cell">
                    {product.description
                      ? product.description.length > 60
                        ? product.description.slice(0, 60) + '…'
                        : product.description
                      : '—'}
                  </td>
                  <td className="font-medium" style={{ color: '#ff9900' }}>
                    ${product.unitPrice.toFixed(2)}
                  </td>
                  <td className="text-iron-100">{product.unitsSold}</td>
                  <td>
                    <button
                      onClick={() => update(product.id, { active: !product.active })}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        product.active
                          ? 'bg-green-900/40 text-green-400 hover:bg-green-900/70'
                          : 'bg-iron-800 text-iron-400 hover:bg-iron-700'
                      }`}
                    >
                      {product.active ? 'Active' : 'Inactive'}
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
