import { describe, expect, it } from 'vitest';
import { deliveryOverview, vendorDeliveryStats } from './vendorPerformance';

const po = (over: Partial<Parameters<typeof vendorDeliveryStats>[0][number]>) => ({
  statusPO: 'diterima',
  tanggalPO: '2026-11-01',
  tanggalKirim: '2026-11-03',
  tanggalDiterima: '2026-11-05',
  estimasiTiba: '2026-11-06',
  ...over,
});

describe('vendorDeliveryStats', () => {
  it('reports no evaluated POs and zero rates when nothing has been received', () => {
    expect(vendorDeliveryStats([po({ statusPO: 'dikirim', tanggalDiterima: undefined })])).toEqual({
      evaluated: 0,
      onTime: 0,
      onTimeRate: 0,
      lateRate: 0,
      avgDelayDays: 0,
      avgLeadTime: 0,
      avgProdDays: 0,
      avgTransDays: 0,
    });
  });

  it('measures lateness against the estimated arrival date', () => {
    const stats = vendorDeliveryStats([po({}), po({ tanggalDiterima: '2026-11-09' })]);
    expect(stats).toMatchObject({ evaluated: 2, onTime: 1, onTimeRate: 50, lateRate: 50, avgDelayDays: 1.5, avgLeadTime: 6 });
  });
});

describe('deliveryOverview', () => {
  it('weights by received POs and returns null when no vendor has any', () => {
    expect(deliveryOverview([vendorDeliveryStats([])])).toBeNull();
    const a = vendorDeliveryStats([po({}), po({}), po({})]);
    const b = vendorDeliveryStats([po({ tanggalDiterima: '2026-11-10' })]);
    expect(deliveryOverview([a, b])).toEqual({ evaluated: 4, onTimeRate: 75, avgDelayDays: 1, avgLeadTime: 5.3 });
  });
});
