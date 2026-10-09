# Revisi meeting SimInvest — 9 Oktober 2026

Paket ini menggunakan HTML terbaru yang dilampirkan pengguna. Form menggunakan
email, nomor HP Indonesia, dan profil risiko. Email lengkap disimpan privat untuk
identifikasi peserta/CRM; leaderboard hanya menampilkan empat karakter awal lalu
12 huruf x. Tidak ada isian nama. Persetujuan promosi telepon/WhatsApp tetap opsional.

## Pasang

1. Di Supabase project `fomrafdtfafvmhnovkrd`, buka **SQL Editor → New query**.
   Salin seluruh `setup-meeting-update.sql`, tekan **Run**. Hasil pemeriksaan akhir:
   `public_reads_masked_scores=true`, `public_inserts_scores_directly=false`,
   `public_reads_contacts=false`. File aman dijalankan ulang untuk versi ini.
2. Salin isi ZIP ke folder repo **Game-Activation-Galaga-SimInvest**. `index.html`
   berada langsung di root; pertahankan `assets/` dan `dlc/vendor/`. Jangan tempel
   HTML ke `src/App.jsx` atau repo POS.
3. Simpan semua file, lalu jalankan di terminal folder game:

   ```powershell
   git add index.html journey.css assets dlc setup-meeting-update.sql export-crm-meeting.sql README-INSTALL.md
   git commit -m "Update event rewards and two-round email leaderboard"
   git push
   ```

4. Tunggu GitHub Pages selesai. Buka halaman game untuk peserta; tambahkan `?tv=1`
   untuk display iPad. Uji dengan satu peserta internal sebelum aktivasi publik.

## Aturan leaderboard

- Dua ronde **sepanjang event**, berdasarkan email dan nomor HP yang dinyatakan
  peserta. Server mempertahankan hitungan ketika pasangan data yang sama didaftar
  ulang melalui browser/perangkat lain. Mengganti salah satu kontak saja ditolak.
- Jatah dipakai saat server mengonfirmasi START, sebelum countdown. Menutup tab
  atau meninggalkan ronde sesudah START tetap memakai jatah.
- Ronde pertama dan kedua boleh masuk; satu peserta muncul sekali per hari dengan
  nilai maksimum dari ronde yang memenuhi jatah pada hari itu. Ronde kedua yang
  lebih rendah pada hari yang sama tidak menurunkan skor pertama.
- Mulai ronde ketiga, permainan menjadi latihan dan tidak memanggil penyimpanan
  skor leaderboard. Peserta tetap bisa mengulangi permainan.
- Leaderboard harian mengikuti **Asia/Jakarta**. Skor diatribusikan ke tanggal
  START, termasuk jika selesai melewati tengah malam. Dua ronde yang dimainkan
  pada tanggal berbeda masuk ke hari masing-masing; kuota tetap total dua.
- Reset harian tidak memberikan kuota baru. Peserta yang sudah memakai dua ronde
  pada hari pertama tidak bisa masuk leaderboard lagi pada hari berikutnya.
- Penyimpanan skor dapat dicoba ulang menggunakan token ronde yang sama tanpa
  menambah jatah atau mengganti nilai skor yang sudah dikonfirmasi server.
- Skor lama di `daily_scores` dan kontak lama di `simoon_participants` **tidak
  dihapus**. Leaderboard versi ini memakai `simoon_event_scores`; arsip nama/skor
  lama tidak diimpor karena tidak mempunyai identitas email/riwayat ronde yang
  dapat diverifikasi. Hitungan kuota versi baru dimulai pada peluncuran versi ini.
- ID event tetap `activation-2026`. Event baru harus memakai konfigurasi/server
  event baru; mengganti tanggal tidak menghapus riwayat kuota.

## Copy penawaran

- **Real Growth Starts Here**.
- **Download SimInvest:** masukkan nomor HP hingga verifikasi email di aplikasi
  SimInvest, serta follow `@Sinarmas_Sekuritas`, `@Sinarmas_am`, `@Sim_Invest`;
  hadiah Parfum 5ml + Sticker Pack. Form game tidak melakukan verifikasi email
  aplikasi SimInvest dan tidak mengonfirmasi Instagram secara otomatis.
- **Bid highest score:** pecahkan rekor Galaga harian, hadiah Parfum 10ml setelah
  pemeriksaan crew.
- **Complete Registration:** selesaikan opening account dan follow sosial media
  di atas; hadiah Parfum 10ml + Sticker Pack. Label KYC di seluruh UI dihapus.
- **Transact:** seluruh Reksa Dana di SimInvest minimal Rp10.000.000, atau transaksi
  saham minimal Rp25.000.000 khusus hari Jumat; Parfum 50ml + merchandise tersedia.
- Semua copy pengganti saat parfum habis / Danamas dihapus. Crew menentukan
  pemenuhan ketentuan dan penyerahan hadiah. Saldo/transaksi/follow tidak diperiksa
  otomatis melalui aplikasi SimInvest.

## Preview dan DLC

- `?preview=1`: form/game dengan data lokal, tanpa menulis ke Supabase.
- `?preview=journey`: langsung menampilkan Journey Ended, dengan peserta simulasi.
- `?tv=1&preview=1`: 10 email tersamarkan dan skor acak stabil per tanggal, dengan
  skor pembuka tertinggi 154.657. Label SIMULASI ditampilkan. Tidak ada peserta
  fiktif yang dimasukkan ke leaderboard publik atau SQL produksi.
- QR tetap membuka halaman utama game publik, tanpa `tv` atau `preview`.
- DLC memakai roket dan transisi 2D → 3D bulan → Bumi yang sama. Dua kesempatan DLC
  per jalur tetap terpisah dari kuota Galaga. Hitungan DLC masih tersimpan lokal
  pada browser, sebagaimana versi sebelumnya; pembaruan server ini untuk Galaga.
- PIN crew merupakan pemeriksaan operasional pada perangkat. Ia tidak membuktikan
  opening account/transaksi dan tidak menjadi otorisasi server untuk hadiah.

## Batas identifikasi dan CRM

Registrasi game tetap anonim, tanpa login/OTP email. Kuota ditegakkan server untuk
kontak yang dinyatakan peserta, tetapi bukan bukti kepemilikan kontak atau sistem
anti-cheat: peserta yang menyatakan email **dan** nomor HP lain bisa membuat
identitas lain, dan server tidak menyimulasikan ulang gameplay untuk membuktikan
keaslian skor. Verifikasi aplikasi/kelayakan hadiah tetap dilakukan crew.

Data peserta baru berada dalam schema `simoon_private`, tidak di Table Editor
`public.simoon_participants` lama. Gunakan `export-crm-meeting.sql` melalui SQL
Editor administrator untuk ekspor. Jangan masukkan session token ke ekspor atau
layar publik. Persetujuan yang ada hanya mencakup telepon/WhatsApp; email pada
form ini tidak otomatis memberi persetujuan email marketing.

## Bukti pemeriksaan

Lihat `validation.md`, `database-validation.json`, `asset-validation.json`, dan
gambar preview iPad. Backend telah diuji di database PostgreSQL lokal terisolasi.
SQL belum diterapkan oleh Codex ke project produksi: konektor Supabase tidak
memiliki izin akses project tersebut. File belum di-commit/push oleh Codex.
