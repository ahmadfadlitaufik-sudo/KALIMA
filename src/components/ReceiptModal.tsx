import React from 'react';
import { X, Printer, Download, CheckCircle2 } from 'lucide-react';
import { Order } from '../types';

interface ReceiptModalProps {
  order: Order | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white text-slate-900 rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Actions (Hidden in Print) */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50/90 border-b border-slate-200/80 print:hidden">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold tracking-tight text-slate-900">
              Nota Transaksi #{order.noOrder}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Nota</span>
            </button>
            <button aria-label="Tutup" data-modal-close
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Style */}
        <div className="p-6 overflow-y-auto font-mono text-xs text-slate-800 space-y-4 print:p-0">
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300">
            <h2 className="text-base font-black tracking-widest text-slate-950 uppercase">
              KALIMA APPAREL
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Heavyweight & Premium Menswear Essentials
            </p>
            <p className="text-[11px] text-slate-600">
              Channel: <span className="font-bold">{order.channel}</span>
            </p>
          </div>

          {/* Info Order */}
          <div className="space-y-1 text-xs pb-3 border-b border-dashed border-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">No. Order:</span>
              <span className="font-bold">{order.noOrder}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tanggal:</span>
              <span>{order.tanggal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pelanggan:</span>
              <span className="font-semibold">{order.customerNama}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">No. HP / Kota:</span>
              <span>{order.customerHp} · {order.customerKota}</span>
            </div>
            {order.noResi && (
              <div className="flex justify-between">
                <span className="text-slate-500">Resi:</span>
                <span className="font-bold">{order.noResi}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Kasir/Admin:</span>
              <span>{order.createdBy}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2 pb-3 border-b border-dashed border-slate-300">
            <div className="flex justify-between font-bold text-xs text-slate-900 border-b border-slate-200 pb-1">
              <span>ITEM</span>
              <span>TOTAL</span>
            </div>
            {order.items.map((it, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="font-bold text-xs leading-tight text-slate-950">
                  {it.namaProduk}
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>
                    {it.qty} x Rp {it.hargaSatuan.toLocaleString('id-ID')}
                  </span>
                  <span className="font-semibold text-slate-900">
                    Rp {it.subtotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Payment Summary */}
          <div className="space-y-1 text-xs pb-3 border-b border-dashed border-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal:</span>
              <span>Rp {order.subtotal.toLocaleString('id-ID')}</span>
            </div>
            {order.diskon > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Diskon:</span>
                <span>- Rp {order.diskon.toLocaleString('id-ID')}</span>
              </div>
            )}
            {order.ongkir > 0 && (
              <div className="flex justify-between">
                <span>Ongkir:</span>
                <span>Rp {order.ongkir.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-200">
              <span>TOTAL TAGIHAN:</span>
              <span>Rp {order.totalTagihan.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold pt-0.5">
              <span>Terbayar:</span>
              <span>Rp {order.totalTerbayar.toLocaleString('id-ID')}</span>
            </div>
            {order.sisaPiutang > 0 ? (
              <div className="flex justify-between text-rose-700 font-bold bg-rose-50 p-1 rounded">
                <span>SISA PIUTANG:</span>
                <span>Rp {order.sisaPiutang.toLocaleString('id-ID')}</span>
              </div>
            ) : (
              <div className="text-center font-bold text-emerald-700 py-1 bg-emerald-50 rounded">
                *** LUNAS ***
              </div>
            )}
            {order.jatuhTempo && order.sisaPiutang > 0 && (
              <div className="flex justify-between text-rose-600 text-[11px]">
                <span>Jatuh Tempo:</span>
                <span>{order.jatuhTempo}</span>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-center space-y-1 text-[11px] text-slate-500 pt-1">
            <p>Terima kasih telah memilih Kalima Apparel.</p>
            <p>Barang yang sudah dibeli dapat ditukar maksimal 3 hari sejak diterima (syarat hangtag & kemasan utuh).</p>
            <p className="font-bold text-slate-700">kalima.id · @kalima.apparel</p>
          </div>
        </div>

        {/* Close button in footer */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 text-center print:hidden">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
