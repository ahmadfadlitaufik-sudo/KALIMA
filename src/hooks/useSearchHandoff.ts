import { useEffect } from 'react';
import type { AppView } from '../context/AppContext';
import { subscribePendingSearch, takePendingSearch } from '../services/searchHandoff';

/** Mengisi kotak cari halaman dengan kata kunci dari pencarian global di header. */
export const useSearchHandoff = (view: AppView, setSearchQuery: (query: string) => void): void => {
  useEffect(() => {
    const initial = takePendingSearch(view);
    if (initial) {
      setSearchQuery(initial);
    }
    return subscribePendingSearch(view, setSearchQuery);
  }, [view, setSearchQuery]);
};
