/** Kinerja pengiriman vendor, dihitung hanya dari PO yang sudah diterima di gudang. */

type DeliveredPO = {
  statusPO: string;
  tanggalPO: string;
  tanggalKirim?: string;
  tanggalDiterima?: string;
  estimasiTiba?: string;
};

export type DeliveryStats = {
  evaluated: number;
  onTime: number;
  onTimeRate: number;
  lateRate: number;
  avgDelayDays: number;
  avgLeadTime: number;
  avgProdDays: number;
  avgTransDays: number;
};

/** Batas lead time bila PO tidak punya estimasi tiba. */
const DEFAULT_LEAD_DAYS = 5;
const DAY = 1000 * 60 * 60 * 24;
const oneDecimal = (value: number): number => Math.round(value * 10) / 10;
const daysBetween = (from: string, to: string): number => Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY);

/** Tepat waktu = diterima paling lambat pada estimasi tiba (atau dalam 5 hari bila tanpa estimasi). Semua nol bila belum ada PO diterima. */
export const vendorDeliveryStats = (pos: DeliveredPO[]): DeliveryStats => {
  const received = pos.filter((po) => po.statusPO === 'diterima' && po.tanggalDiterima);
  let onTime = 0;
  let delay = 0;
  let lead = 0;
  let prod = 0;
  let trans = 0;
  received.forEach((po) => {
    const arrived = po.tanggalDiterima as string;
    const shipped = po.tanggalKirim || po.tanggalPO;
    const leadDays = Math.max(1, daysBetween(po.tanggalPO, arrived));
    lead += leadDays;
    prod += Math.max(1, daysBetween(po.tanggalPO, shipped));
    trans += Math.max(1, daysBetween(shipped, arrived));
    const late = po.estimasiTiba ? daysBetween(po.estimasiTiba, arrived) : leadDays - DEFAULT_LEAD_DAYS;
    if (late > 0) {
      delay += late;
    } else {
      onTime++;
    }
  });
  const n = received.length;
  if (n === 0) {
    return { evaluated: 0, onTime: 0, onTimeRate: 0, lateRate: 0, avgDelayDays: 0, avgLeadTime: 0, avgProdDays: 0, avgTransDays: 0 };
  }
  const onTimeRate = Math.round((onTime / n) * 100);
  return {
    evaluated: n,
    onTime,
    onTimeRate,
    lateRate: 100 - onTimeRate,
    avgDelayDays: oneDecimal(delay / n),
    avgLeadTime: oneDecimal(lead / n),
    avgProdDays: oneDecimal(prod / n),
    avgTransDays: oneDecimal(trans / n),
  };
};

/** Gabungan semua vendor, ditimbang per PO yang diterima; null bila belum ada satu pun. */
export const deliveryOverview = (
  stats: DeliveryStats[],
): { evaluated: number; onTimeRate: number; avgDelayDays: number; avgLeadTime: number } | null => {
  const evaluated = stats.reduce((sum, s) => sum + s.evaluated, 0);
  if (evaluated === 0) {
    return null;
  }
  const weighted = (pick: (s: DeliveryStats) => number) => stats.reduce((sum, s) => sum + pick(s) * s.evaluated, 0) / evaluated;
  return {
    evaluated,
    onTimeRate: Math.round((stats.reduce((sum, s) => sum + s.onTime, 0) / evaluated) * 100),
    avgDelayDays: oneDecimal(weighted((s) => s.avgDelayDays)),
    avgLeadTime: oneDecimal(weighted((s) => s.avgLeadTime)),
  };
};
