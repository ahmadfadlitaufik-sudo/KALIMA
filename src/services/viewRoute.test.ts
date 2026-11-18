import { describe, expect, it } from 'vitest';
import { pathToView, viewToPath } from './viewRoute';

describe('view routes', () => {
  it('maps every view to its own path and back', () => {
    const views = ['dashboard', 'sales', 'inventory', 'purchases', 'products', 'customers', 'reseller', 'finance', 'import_export', 'audit', 'users'] as const;
    const paths = new Set<string>();
    for (const view of views) {
      paths.add(viewToPath(view));
      expect(pathToView(viewToPath(view))).toBe(view);
    }
    expect(paths.size).toBe(views.length);
  });

  it('uses readable Indonesian paths', () => {
    expect(viewToPath('dashboard')).toBe('/');
    expect(viewToPath('sales')).toBe('/penjualan');
    expect(viewToPath('finance')).toBe('/keuangan');
  });

  it('falls back to the dashboard for unknown paths and ignores a trailing slash', () => {
    expect(pathToView('/tidak-ada')).toBe('dashboard');
    expect(pathToView('/penjualan/')).toBe('sales');
  });

  it('also opens a page from its English name, such as /inventory', () => {
    expect(pathToView('/inventory')).toBe('inventory');
    expect(pathToView('/customers')).toBe('customers');
    expect(pathToView('/products/')).toBe('products');
  });

  it('opens the profile page at /profil and its English alias', () => {
    expect(pathToView('/profil')).toBe('profile');
    expect(pathToView('/profile')).toBe('profile');
    expect(viewToPath('profile')).toBe('/profil');
  });
});
