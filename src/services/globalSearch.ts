/** Pencarian cepat lintas order, SKU, dan pelanggan untuk kotak cari di header. */

type SearchableOrder = {
  id: string;
  noOrder: string;
  customerNama: string;
  customerHp?: string;
  noResi?: string;
  items: { sku: string; namaProduk: string }[];
};
type SearchableSku = { sku: string; name: string; colorName?: string };
type SearchableCustomer = { id: string; nama: string; noHp?: string; kota?: string };

export type SearchResults<O, S, C> = { orders: O[]; skus: S[]; customers: C[] };

export const MIN_QUERY_LENGTH = 2;

const contains = (needle: string, ...fields: (string | undefined)[]): boolean =>
  fields.some((field) => field?.toLowerCase().includes(needle));

export const searchAll = <O extends SearchableOrder, S extends SearchableSku, C extends SearchableCustomer>(
  query: string,
  data: { orders: O[]; skus: S[]; customers: C[] },
  limit = 5,
): SearchResults<O, S, C> => {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_QUERY_LENGTH) {
    return { orders: [], skus: [], customers: [] };
  }
  return {
    orders: data.orders
      .filter(
        (order) =>
          contains(needle, order.noOrder, order.customerNama, order.customerHp, order.noResi) ||
          order.items.some((item) => contains(needle, item.sku, item.namaProduk)),
      )
      .slice(0, limit),
    skus: data.skus.filter((sku) => contains(needle, sku.sku, sku.name, sku.colorName)).slice(0, limit),
    customers: data.customers.filter((customer) => contains(needle, customer.nama, customer.noHp, customer.kota)).slice(0, limit),
  };
};
