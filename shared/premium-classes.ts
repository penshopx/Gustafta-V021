// Kelas Premium 1–4 — band harga LISENSI (sekali bayar) untuk chatbot premium.
// SUMBER TUNGGAL: jangan hardcode angka harga kelas di tempat lain (client/server).
// Sumbu ini TERPISAH dari:
//   - premiumClass "standard"/"private" (cara distribusi/clone), dan
//   - tier langganan platform (Starter→Enterprise, biaya bulanan hosting).
// Lisensi = sekali bayar, tetap; biaya bulanan tetap ditagih terpisah untuk SEMUA produk.

export interface PremiumClass {
  id: 1 | 2 | 3 | 4;
  label: string;
  price: number; // harga lisensi sekali bayar (IDR)
  blurb: string;
}

export const PREMIUM_CLASSES: Record<1 | 2 | 3 | 4, PremiumClass> = {
  1: { id: 1, label: "Kelas Premium 1", price: 1_000_000, blurb: "Chatbot premium entry-level." },
  2: { id: 2, label: "Kelas Premium 2", price: 2_500_000, blurb: "Chatbot premium menengah." },
  3: { id: 3, label: "Kelas Premium 3", price: 5_000_000, blurb: "Chatbot premium lanjutan." },
  4: { id: 4, label: "Kelas Premium 4", price: 10_000_000, blurb: "Chatbot premium tingkat tertinggi." },
};

export const PREMIUM_CLASS_IDS = [1, 2, 3, 4] as const;

export function isPremiumClass(n: unknown): n is 1 | 2 | 3 | 4 {
  return n === 1 || n === 2 || n === 3 || n === 4;
}

// Harga lisensi untuk sebuah kelas; null bila bukan produk berkelas.
export function priceForClass(n: number | null | undefined): number | null {
  return isPremiumClass(n) ? PREMIUM_CLASSES[n].price : null;
}

// Metadata kelas (label/blurb/price) atau null bila tak valid.
export function premiumClassInfo(n: number | null | undefined): PremiumClass | null {
  return isPremiumClass(n) ? PREMIUM_CLASSES[n] : null;
}
