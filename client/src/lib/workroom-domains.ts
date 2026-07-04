export interface WorkroomField {
  key: string;
  label: string;
  placeholder: string;
  textarea?: boolean;
}

export interface WorkroomDomainMeta {
  key: string;
  label: string;
  short: string;
  desc: string;
  analyzeHeading: string;
  analyzeDesc: string;
  scoreLabel: string;
  fields: WorkroomField[];
}

export const WORKROOM_DOMAIN_META: WorkroomDomainMeta[] = [
  {
    key: "tender",
    label: "Tender / Pengadaan",
    short: "Tender",
    desc: "Garap tender bertahap: identifikasi peluang, analisis kelayakan, sampai gerbang persetujuan ◆ sebelum submit.",
    analyzeHeading: "Analisis AI — Kelayakan & Win Probability",
    analyzeDesc: "Agen menilai kelayakan ikut tender + estimasi peluang menang berdasarkan data workroom.",
    scoreLabel: "Win probability",
    fields: [
      { key: "instansi", label: "Instansi / Pemberi Kerja", placeholder: "mis. Dinas PUPR Kab. X" },
      { key: "nilai", label: "Nilai Pagu / HPS", placeholder: "mis. Rp 4,5 Miliar" },
      { key: "catatan", label: "Catatan Awal", placeholder: "Ringkas syarat, kualifikasi SBU/SKK, deadline, atau catatan lain.", textarea: true },
    ],
  },
  {
    key: "perizinan",
    label: "Perizinan Berusaha (OSS)",
    short: "Perizinan",
    desc: "Urus izin berusaha bertahap: identifikasi jenis izin & KBLI, cek persyaratan risiko, sampai terbit lewat OSS.",
    analyzeHeading: "Analisis AI — Kesiapan Perizinan",
    analyzeDesc: "Agen menilai kesiapan berkas & kondisi usaha untuk diajukan ke OSS (berbasis PP 28/2025).",
    scoreLabel: "Skor kesiapan",
    fields: [
      { key: "jenisUsaha", label: "Jenis Usaha / KBLI", placeholder: "mis. Konstruksi gedung — 41011" },
      { key: "skala", label: "Skala Usaha", placeholder: "mis. Menengah / Besar" },
      { key: "catatan", label: "Catatan Awal", placeholder: "Bentuk badan usaha, lokasi, tingkat risiko, dokumen yang sudah ada.", textarea: true },
    ],
  },
  {
    key: "skk",
    label: "Sertifikasi Kompetensi (SKK)",
    short: "SKK",
    desc: "Siapkan uji kompetensi SKK bertahap: identifikasi jabatan & jenjang, susun portofolio, sampai uji di LSP.",
    analyzeHeading: "Analisis AI — Kesiapan Sertifikasi SKK",
    analyzeDesc: "Agen menilai kelayakan mendaftar & kesiapan lulus uji kompetensi (skema BNSP/LSP).",
    scoreLabel: "Skor kesiapan lulus",
    fields: [
      { key: "jabatan", label: "Jabatan Kerja", placeholder: "mis. Ahli Manajemen Konstruksi" },
      { key: "jenjang", label: "Jenjang", placeholder: "mis. Jenjang 7 / Ahli Muda" },
      { key: "catatan", label: "Catatan Awal", placeholder: "Pendidikan, pengalaman, bukti/portofolio yang dimiliki.", textarea: true },
    ],
  },
  {
    key: "k3",
    label: "K3 / SMK3 Konstruksi",
    short: "K3",
    desc: "Susun penerapan K3 proyek bertahap: identifikasi bahaya, penilaian risiko HIRADC, sampai dokumen RKK/SMK3.",
    analyzeHeading: "Analisis AI — Kesiapan K3 / SMK3",
    analyzeDesc: "Agen menilai kematangan & kesiapan sistem K3 proyek (berbasis PermenPUPR 10/2021 & PP 50/2012).",
    scoreLabel: "Skor kematangan K3",
    fields: [
      { key: "proyek", label: "Nama / Jenis Proyek", placeholder: "mis. Pembangunan jembatan bentang 40m" },
      { key: "lingkup", label: "Lingkup Pekerjaan", placeholder: "mis. Pekerjaan ketinggian, galian dalam" },
      { key: "catatan", label: "Catatan Awal", placeholder: "Jumlah pekerja, bahaya utama, dokumen K3 yang sudah ada.", textarea: true },
    ],
  },
];

const DEFAULT_META = WORKROOM_DOMAIN_META[0];

export function workroomDomainMeta(domain?: string | null): WorkroomDomainMeta {
  return WORKROOM_DOMAIN_META.find((d) => d.key === (domain || "").toLowerCase()) || DEFAULT_META;
}
