-- Hitung gagal login per email + alamat jaringan, agar penyerang tidak bisa mengunci Owner dari semua tempat.
ALTER TABLE login_failures ADD COLUMN ip TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_login_failures_email_ip ON login_failures (email, ip, failed_at);
