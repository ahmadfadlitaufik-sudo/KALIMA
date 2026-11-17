import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Package, Receipt, Search, User } from 'lucide-react';
import { useApp, type AppView } from '../context/AppContext';
import { MIN_QUERY_LENGTH, searchAll } from '../services/globalSearch';
import { pushPendingSearch } from '../services/searchHandoff';

/** Kotak cari di header: order, SKU, pelanggan. Ctrl/⌘+K atau "/" untuk membuka. */
export const GlobalSearch: React.FC = () => {
  const { orders, skus, customers, setCurrentView } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchAll(query, { orders, skus, customers }), [query, orders, skus, customers]);
  const hasResults = results.orders.length + results.skus.length + results.customers.length > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    inputRef.current?.focus();
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const goTo = (view: AppView, value: string) => {
    pushPendingSearch(view, value);
    setCurrentView(view);
    setOpen(false);
    setQuery('');
  };

  const rowClassName = 'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-slate-100 focus:bg-slate-100 focus:outline-none';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Cari order, SKU, atau pelanggan (Ctrl+K)"
        aria-label="Cari order, SKU, atau pelanggan"
        aria-expanded={open}
        className="btn-circle-action cursor-pointer"
      >
        <Search className="w-4 h-4 text-slate-600" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[min(92vw,420px)] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <div className="flex items-center gap-2 px-2 border-b border-slate-100 pb-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="No order, nama/HP pelanggan, kode SKU…"
              aria-label="Kata kunci pencarian"
              className="w-full py-2 text-sm bg-transparent focus:outline-none"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto pt-1">
            {query.trim().length < MIN_QUERY_LENGTH ? (
              <p className="px-3 py-4 text-xs text-slate-500">Ketik minimal {MIN_QUERY_LENGTH} huruf.</p>
            ) : !hasResults ? (
              <p className="px-3 py-4 text-xs text-slate-500">Tidak ada yang cocok dengan “{query.trim()}”.</p>
            ) : (
              <>
                {results.orders.length > 0 && (
                  <section>
                    <h3 className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Order</h3>
                    {results.orders.map((order) => (
                      <button key={order.id} type="button" className={rowClassName} onClick={() => goTo('sales', order.noOrder)}>
                        <Receipt className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900 truncate">{order.noOrder}</span>
                          <span className="block text-xs text-slate-500 truncate">
                            {order.tanggal} · {order.customerNama}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                          Rp {order.totalTagihan.toLocaleString('id-ID')}
                        </span>
                      </button>
                    ))}
                  </section>
                )}
                {results.skus.length > 0 && (
                  <section>
                    <h3 className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">SKU / Stok</h3>
                    {results.skus.map((sku) => (
                      <button key={sku.sku} type="button" className={rowClassName} onClick={() => goTo('inventory', sku.sku)}>
                        <Package className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900 truncate">{sku.name}</span>
                          <span className="block text-xs text-slate-500 truncate">{sku.sku}</span>
                        </span>
                      </button>
                    ))}
                  </section>
                )}
                {results.customers.length > 0 && (
                  <section>
                    <h3 className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Pelanggan</h3>
                    {results.customers.map((customer) => (
                      <button key={customer.id} type="button" className={rowClassName} onClick={() => goTo('customers', customer.nama)}>
                        <User className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900 truncate">{customer.nama}</span>
                          <span className="block text-xs text-slate-500 truncate">
                            {[customer.noHp, customer.kota].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    ))}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
