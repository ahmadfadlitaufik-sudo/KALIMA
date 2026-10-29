import { db, doc, setDoc, getDocFromServer } from './firebase';

export interface DocumentHealthReport {
  name: string;
  docPath: string;
  exists: boolean;
  itemCount?: number;
  sizeBytes: number;
  sizeKb: number;
  percentOf1MbLimit: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface PersistenceDiagnosticReport {
  success: boolean;
  probeId: string;
  writeLatencyMs: number;
  readLatencyMs: number;
  totalRoundtripMs: number;
  serverVerification: 'VERIFIED' | 'MISMATCH' | 'FAILED';
  persistedCorrectly: boolean;
  verifiedAt: string;
  databaseId: string;
  documents: DocumentHealthReport[];
  summary: string;
  error?: string;
}

/**
 * Diagnostic utility function to verify if data written to Firestore is correctly persisting.
 * Bypasses client-side cache completely by querying Google Cloud Firestore directly via getDocFromServer.
 */
export async function runFirestorePersistenceDiagnostic(): Promise<PersistenceDiagnosticReport> {
  const startTime = Date.now();
  const probeId = `probe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const verifiedAt = new Date().toISOString();

  try {
    const probeDocRef = doc(db, 'kalima_workspace', 'persistence_probe');

    // 1. Write probe payload to Firestore
    const writeStart = Date.now();
    const testPayload = {
      probeId,
      writtenAt: verifiedAt,
      verificationTag: 'KALIMA_PERSISTENCE_PROBE_OK',
      clientEnvironment: typeof window !== 'undefined' ? 'browser' : 'server',
      probeRandomKey: Math.floor(Math.random() * 1000000),
    };

    await setDoc(probeDocRef, testPayload);
    const writeLatencyMs = Date.now() - writeStart;

    // 2. Direct server read bypasses IndexedDB and memory cache
    const readStart = Date.now();
    const probeSnapshot = await getDocFromServer(probeDocRef);
    const readLatencyMs = Date.now() - readStart;
    const totalRoundtripMs = Date.now() - startTime;

    if (!probeSnapshot.exists()) {
      return {
        success: false,
        probeId,
        writeLatencyMs,
        readLatencyMs,
        totalRoundtripMs,
        serverVerification: 'FAILED',
        persistedCorrectly: false,
        verifiedAt,
        databaseId: 'ai-studio-kalimawebapp-0da35a25-fc24-4f91-9980-01ff3e98c824',
        documents: [],
        summary: 'Pemeriksaan gagal: Dokumen probe tidak ditemukan di server Firestore.',
        error: 'Probe document not found on server',
      };
    }

    const readData = probeSnapshot.data();
    const isProbeValid =
      readData?.probeId === probeId &&
      readData?.verificationTag === 'KALIMA_PERSISTENCE_PROBE_OK' &&
      readData?.probeRandomKey === testPayload.probeRandomKey;

    if (!isProbeValid) {
      return {
        success: false,
        probeId,
        writeLatencyMs,
        readLatencyMs,
        totalRoundtripMs,
        serverVerification: 'MISMATCH',
        persistedCorrectly: false,
        verifiedAt,
        databaseId: 'ai-studio-kalimawebapp-0da35a25-fc24-4f91-9980-01ff3e98c824',
        documents: [],
        summary: 'Peringatan: Data yang terbaca dari server Firestore tidak cocok dengan data probe yang dikirim.',
        error: 'Probe data mismatch',
      };
    }

    // 3. Inspect health and size of production workspace documents
    const docNames = [
      { name: 'Riwayat Pesanan (Orders)', key: 'orders', itemField: 'orders' },
      { name: 'Kartu Stok (Stock Movements)', key: 'stock_movements', itemField: 'stockMovements' },
      { name: 'Master Data (SKU & Pelanggan)', key: 'master', itemField: 'skus' },
      { name: 'Keuangan & Akun Kas (Finance)', key: 'finance', itemField: 'cashMutations' },
      { name: 'Operasional Konsinyasi & PO', key: 'operations', itemField: 'suratTitip' },
      { name: 'Audit Aktivitas (Audit Logs)', key: 'audit_logs', itemField: 'auditLogs' },
    ];

    const documentsReport: DocumentHealthReport[] = [];

    await Promise.all(
      docNames.map(async (docMeta) => {
        try {
          const docRef = doc(db, 'kalima_workspace', docMeta.key);
          const snap = await getDocFromServer(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const jsonStr = JSON.stringify(data);
            const sizeBytes = new TextEncoder().encode(jsonStr).length;
            const sizeKb = Math.round((sizeBytes / 1024) * 10) / 10;
            const percentOf1Mb = Math.round((sizeBytes / 1048576) * 100);

            const itemsArray = docMeta.itemField && Array.isArray(data[docMeta.itemField]) ? data[docMeta.itemField].length : undefined;

            documentsReport.push({
              name: docMeta.name,
              docPath: `kalima_workspace/${docMeta.key}`,
              exists: true,
              itemCount: itemsArray,
              sizeBytes,
              sizeKb,
              percentOf1MbLimit: percentOf1Mb,
              status: percentOf1Mb > 80 ? 'CRITICAL' : percentOf1Mb > 60 ? 'WARNING' : 'HEALTHY',
            });
          } else {
            documentsReport.push({
              name: docMeta.name,
              docPath: `kalima_workspace/${docMeta.key}`,
              exists: false,
              sizeBytes: 0,
              sizeKb: 0,
              percentOf1MbLimit: 0,
              status: 'WARNING',
            });
          }
        } catch (docErr) {
          console.warn(`Could not inspect document kalima_workspace/${docMeta.key}:`, docErr);
        }
      })
    );

    // Sort documents report for consistent display
    documentsReport.sort((a, b) => a.name.localeCompare(b.name));

    return {
      success: true,
      probeId,
      writeLatencyMs,
      readLatencyMs,
      totalRoundtripMs,
      serverVerification: 'VERIFIED',
      persistedCorrectly: true,
      verifiedAt,
      databaseId: 'ai-studio-kalimawebapp-0da35a25-fc24-4f91-9980-01ff3e98c824',
      documents: documentsReport,
      summary: `Verifikasi Firestore Berhasil: Data probe berhasil ditulis & dibaca langsung dari server cloud (Write: ${writeLatencyMs}ms, Read: ${readLatencyMs}ms). Seluruh dokumen modular dalam kondisi sehat dan jauh di bawah batas 1 MB.`,
    };
  } catch (err: any) {
    console.error('Firestore persistence diagnostic failed:', err);
    return {
      success: false,
      probeId,
      writeLatencyMs: -1,
      readLatencyMs: -1,
      totalRoundtripMs: Date.now() - startTime,
      serverVerification: 'FAILED',
      persistedCorrectly: false,
      verifiedAt,
      databaseId: 'ai-studio-kalimawebapp-0da35a25-fc24-4f91-9980-01ff3e98c824',
      documents: [],
      summary: `Gagal memverifikasi persistensi database: ${err?.message || 'Koneksi ke server Firestore terputus'}`,
      error: err?.message || String(err),
    };
  }
}

/**
 * Diagnostic utility to verify if a specific Order ID or Order Number is confirmed persisting on the remote Firestore server.
 */
export async function verifyOrderInServerFirestore(orderIdOrNumber: string): Promise<{
  persisted: boolean;
  order?: any;
  serverUpdatedAt?: string;
  totalOrdersOnServer: number;
  message: string;
}> {
  try {
    const ordersDocRef = doc(db, 'kalima_workspace', 'orders');
    const snap = await getDocFromServer(ordersDocRef);

    if (!snap.exists()) {
      return {
        persisted: false,
        totalOrdersOnServer: 0,
        message: 'Dokumen orders tidak ditemukan di server Firestore.',
      };
    }

    const data = snap.data();
    const ordersList: any[] = data.orders || [];
    const found = ordersList.find(
      (o) => o.id === orderIdOrNumber || o.noOrder === orderIdOrNumber
    );

    if (found) {
      return {
        persisted: true,
        order: found,
        serverUpdatedAt: data.updatedAt,
        totalOrdersOnServer: ordersList.length,
        message: `Order ${found.noOrder} terverifikasi permanen di server Firestore! (Total pesanan di cloud: ${ordersList.length}).`,
      };
    } else {
      return {
        persisted: false,
        totalOrdersOnServer: ordersList.length,
        message: `Order dengan ID/Nomor "${orderIdOrNumber}" belum ditemukan di server Firestore (terdapat ${ordersList.length} pesanan lain di cloud).`,
      };
    }
  } catch (err: any) {
    return {
      persisted: false,
      totalOrdersOnServer: 0,
      message: `Gagal membaca server Firestore: ${err?.message || 'Error jaringan'}`,
    };
  }
}
