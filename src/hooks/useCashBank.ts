import { useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Order } from '../types';

/**
 * Hook `useCashBank` untuk mengelola saldo Kas & Bank,
 * memotong saldo secara otomatis saat transaksi penjualan, refund, atau biaya operasional disimpan,
 * serta mencatat mutasi kas secara real-time.
 */
export const useCashBank = () => {
  const {
    cashAccounts,
    cashMutations,
    recordCashTransaction,
    recordPayment,
  } = useApp();

  // Akun kas default atau akun pertama
  const defaultAccount = useMemo(() => {
    return cashAccounts.find((a) => a.isDefault) || cashAccounts[0];
  }, [cashAccounts]);

  // Total likuiditas seluruh kas & bank
  const totalSaldo = useMemo(() => {
    return cashAccounts.reduce((sum, acc) => sum + (acc.saldo || 0), 0);
  }, [cashAccounts]);

  const getAccount = useCallback(
    (id?: string) => {
      if (!id) return undefined;
      return cashAccounts.find((a) => a.id === id);
    },
    [cashAccounts]
  );

  /**
   * Memotong saldo kas/bank yang dipilih secara langsung (Debit / Pengeluaran / Keluar).
   */
  const potongSaldo = useCallback(
    (params: {
      accountId: string;
      jumlah: number;
      kategori: string;
      deskripsi: string;
      referensi?: string;
      tanggal?: string;
    }) => {
      const targetAcc = cashAccounts.find((a) => a.id === params.accountId);
      if (!targetAcc) {
        return { success: false, error: 'Akun kas/bank tidak ditemukan.' };
      }
      if (params.jumlah <= 0) {
        return { success: false, error: 'Nominal pemotongan harus lebih besar dari 0.' };
      }

      recordCashTransaction({
        accountId: params.accountId,
        tipe: 'keluar',
        jumlah: params.jumlah,
        kategori: params.kategori,
        deskripsi: params.deskripsi,
        referensi: params.referensi,
        tanggal: params.tanggal,
      });

      return { success: true };
    },
    [cashAccounts, recordCashTransaction]
  );

  /**
   * Menambah saldo kas/bank yang dipilih (Kredit / Pemasukan / Masuk).
   */
  const tambahSaldo = useCallback(
    (params: {
      accountId: string;
      jumlah: number;
      kategori: string;
      deskripsi: string;
      referensi?: string;
      tanggal?: string;
    }) => {
      const targetAcc = cashAccounts.find((a) => a.id === params.accountId);
      if (!targetAcc) {
        return { success: false, error: 'Akun kas/bank tidak ditemukan.' };
      }
      if (params.jumlah <= 0) {
        return { success: false, error: 'Nominal penambahan harus lebih besar dari 0.' };
      }

      recordCashTransaction({
        accountId: params.accountId,
        tipe: 'masuk',
        jumlah: params.jumlah,
        kategori: params.kategori,
        deskripsi: params.deskripsi,
        referensi: params.referensi,
        tanggal: params.tanggal,
      });

      return { success: true };
    },
    [cashAccounts, recordCashTransaction]
  );

  /**
   * Hook/Service otomatis yang dipanggil saat transaksi penjualan berhasil disimpan:
   * 1. Menambah saldo kas untuk nominal penjualan yang terbayar.
   * 2. Secara otomatis memotong saldo akun kas/bank jika ada talangan ongkir atau admin fee toko.
   */
  const handleSalesTransactionSaved = useCallback(
    (params: {
      order: Order;
      paymentAccountId?: string;
      potongOngkirAccountId?: string;
      potongAdminAccountId?: string;
      potongOngkirDariKas?: boolean;
      potongAdminDariKas?: boolean;
    }) => {
      const {
        order,
        paymentAccountId,
        potongOngkirAccountId,
        potongAdminAccountId,
        potongOngkirDariKas,
        potongAdminDariKas,
      } = params;

      const fallbackAcc = defaultAccount || cashAccounts[0];

      // 1. Tambah saldo penerimaan pembayaran jika ada terbayar
      if (order.totalTerbayar > 0) {
        const targetAccId = paymentAccountId || fallbackAcc?.id;
        if (targetAccId) {
          tambahSaldo({
            accountId: targetAccId,
            jumlah: order.totalTerbayar,
            kategori: 'Penjualan Order',
            deskripsi: `Penerimaan bayar order #${order.noOrder} (${order.channel}) - ${order.customerNama}`,
            referensi: `Order #${order.noOrder}`,
            tanggal: order.tanggal,
          });
        }
      }

      // 2. Potong saldo kas untuk talangan ongkir pengiriman jika opsi dipilih
      if (potongOngkirDariKas && order.ongkir > 0) {
        const targetDeductId = potongOngkirAccountId || paymentAccountId || fallbackAcc?.id;
        if (targetDeductId) {
          potongSaldo({
            accountId: targetDeductId,
            jumlah: order.ongkir,
            kategori: 'Biaya Pengiriman (Ongkir)',
            deskripsi: `Talangan ongkir kirim order #${order.noOrder} ke ${order.customerKota || order.customerNama}`,
            referensi: `Order #${order.noOrder}`,
            tanggal: order.tanggal,
          });
        }
      }

      // 3. Potong saldo kas untuk fee marketplace jika opsi dipilih
      if (potongAdminDariKas && order.adminFeeAmount > 0) {
        const targetAdminId = potongAdminAccountId || paymentAccountId || fallbackAcc?.id;
        if (targetAdminId) {
          potongSaldo({
            accountId: targetAdminId,
            jumlah: order.adminFeeAmount,
            kategori: 'Biaya Admin Marketplace',
            deskripsi: `Potongan fee marketplace order #${order.noOrder} (${order.channel})`,
            referensi: `Order #${order.noOrder}`,
            tanggal: order.tanggal,
          });
        }
      }
    },
    [cashAccounts, defaultAccount, potongSaldo, tambahSaldo]
  );

  /**
   * Hook/Service otomatis saat pelunasan piutang penjualan disimpan di SalesView atau FinanceView.
   */
  const handleSalesPaymentSaved = useCallback(
    (params: {
      orderId: string;
      amount: number;
      method: string;
      accountId?: string;
      note?: string;
    }) => {
      recordPayment(
        params.orderId,
        params.amount,
        params.method,
        params.note,
        params.accountId
      );
    },
    [recordPayment]
  );

  /**
   * Hook/Service otomatis pemotongan kas saat pembatalan order penjualan (Refund dana ke pembeli).
   */
  const handleSalesRefund = useCallback(
    (params: {
      order: Order;
      refundAmount: number;
      accountId?: string;
      alasan?: string;
    }) => {
      const targetAccId = params.accountId || defaultAccount?.id || cashAccounts[0]?.id;
      if (!targetAccId || params.refundAmount <= 0) return;

      potongSaldo({
        accountId: targetAccId,
        jumlah: params.refundAmount,
        kategori: 'Refund Pembatalan Penjualan',
        deskripsi: `Pengembalian dana batal order #${params.order.noOrder} ke ${params.order.customerNama}${params.alasan ? ` (${params.alasan})` : ''}`,
        referensi: `Batal #${params.order.noOrder}`,
      });
    },
    [cashAccounts, defaultAccount, potongSaldo]
  );

  /**
   * Hook/Service otomatis pemotongan kas saat pengeluaran operasional (OPEX) disimpan di FinanceView.
   */
  const handleOpexSaved = useCallback(
    (params: {
      opexId: string;
      kategori: string;
      deskripsi: string;
      jumlah: number;
      accountId: string;
      tanggal?: string;
    }) => {
      potongSaldo({
        accountId: params.accountId,
        jumlah: params.jumlah,
        kategori: `Biaya: ${params.kategori}`,
        deskripsi: params.deskripsi,
        referensi: `OPEX #${params.opexId}`,
        tanggal: params.tanggal,
      });
    },
    [potongSaldo]
  );

  return useMemo(
    () => ({
      cashAccounts,
      cashMutations,
      defaultAccount,
      totalSaldo,
      getAccount,
      potongSaldo,
      tambahSaldo,
      handleSalesTransactionSaved,
      handleSalesPaymentSaved,
      handleSalesRefund,
      handleOpexSaved,
    }),
    [
      cashAccounts,
      cashMutations,
      defaultAccount,
      totalSaldo,
      getAccount,
      potongSaldo,
      tambahSaldo,
      handleSalesTransactionSaved,
      handleSalesPaymentSaved,
      handleSalesRefund,
      handleOpexSaved,
    ]
  );
};
