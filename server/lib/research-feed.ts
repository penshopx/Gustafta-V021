import * as cheerio from "cheerio";
import { storage } from "../storage";
import { processKnowledgeBaseForRAG } from "./rag-service";

// ─────────────────────────────────────────────────────────────────────────────
// RESEARCH FEED — memberi "mata" nyata kepada tim riset.
// Dua tujuan:
//   (1) MEMPERKUAT PRODUK: pantau isu/regulasi/pain point domain 80 claw premium.
//   (2) MEMPERKUAT PASAR:  pantau tren iklan & produk viral (TikTok/Facebook/e-commerce).
// Sumber feed: Google News RSS (agregasi berita publik, GRATIS, tanpa API key).
// Hasil di-ingest ke Knowledge Base agen riset sehingga terambil saat chat (RAG).
// Jujur-by-design: ini agregasi berita publik, BUKAN scraping sosmed real-time.
// Riset mendalam Facebook Ad Library / TikTok Shop = manual/tool berbayar → agen
// dibekali "Panduan Metode Riset" (playbook langkah demi langkah) sebagai KB statis.
// ─────────────────────────────────────────────────────────────────────────────

export const RESEARCH_LOCAL_SLUG = "riset-viral-lokal";
export const RESEARCH_GLOBAL_SLUG = "riset-tren-global";
export const RESEARCH_MARKET_SLUG = "riset-iklan-pasar";

const FEED_KB_PREFIX = "Feed Riset";
const METHOD_KB_PREFIX = "Panduan Metode Riset";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  snippet: string;
}

export interface TopicGroup {
  query: string;
  items: NewsItem[];
}

/** Topik boleh string sederhana, atau objek dengan locale sendiri (untuk campur nasional+global). */
export type TopicSpec = string | { q: string; hl?: string; gl?: string };

export interface FeedStream {
  slug: string;
  /** Label KB + judul dokumen. */
  docTitle: string;
  kbLabel: string;
  defaultHl: string;
  defaultGl: string;
  topics: TopicSpec[];
  perTopic?: number;
}

// ── Konfigurasi stream feed (sumber tunggal) ────────────────────────────────
export const FEED_STREAMS: FeedStream[] = [
  {
    // (1) PENGUATAN PRODUK — domain 80 claw premium (konstruksi/sertifikasi/legal/bisnis).
    slug: RESEARCH_LOCAL_SLUG,
    docTitle: "Isu & Pain Point Produk (Indonesia)",
    kbLabel: "Produk Lokal (Indonesia)",
    defaultHl: "id",
    defaultGl: "ID",
    topics: [
      "tender konstruksi pengadaan LKPP Indonesia",
      "sertifikasi badan usaha SBU konstruksi terbaru",
      "sertifikat kompetensi kerja SKK konstruksi",
      "regulasi K3 keselamatan konstruksi proyek",
      "perizinan berusaha OSS konstruksi PP 28 2025",
      "ISO 9001 14001 SMK3 SMAP sertifikasi perusahaan",
      "developer properti real estate Indonesia regulasi",
      "UMKM digitalisasi AI chatbot bisnis Indonesia",
    ],
  },
  {
    // (2) SINYAL GLOBAL — teknologi & AI yang bisa diadaptasi ke produk.
    slug: RESEARCH_GLOBAL_SLUG,
    docTitle: "Tren Global / Teknologi & AI",
    kbLabel: "Global (Luar Negeri)",
    defaultHl: "en",
    defaultGl: "US",
    topics: [
      "AI agents for small business",
      "vertical AI SaaS startup",
      "AI automation compliance certification",
      "construction technology AI",
      "no-code AI assistant builder",
      "AI chatbot customer service trends",
    ],
  },
  {
    // (3) PENGUATAN PASAR — riset iklan & produk viral (nasional + global).
    slug: RESEARCH_MARKET_SLUG,
    docTitle: "Riset Iklan, Viral & Pasar",
    kbLabel: "Iklan & Pasar (Nasional + Global)",
    defaultHl: "id",
    defaultGl: "ID",
    topics: [
      "produk viral TikTok Shop Indonesia",
      "tren iklan Facebook Ads Indonesia",
      "strategi konten viral pemasaran digital UMKM Indonesia",
      "tren jualan online marketplace Indonesia",
      { q: "viral marketing trends", hl: "en", gl: "US" },
      { q: "TikTok Shop trending products", hl: "en", gl: "US" },
      { q: "Facebook ad library winning ads", hl: "en", gl: "US" },
    ],
  },
];

/**
 * Ambil berita dari Google News RSS untuk sebuah query.
 * hl = bahasa, gl = negara, ceid = country:lang.
 */
export async function fetchGoogleNews(
  query: string,
  opts: { hl?: string; gl?: string; limit?: number } = {},
): Promise<NewsItem[]> {
  const hl = opts.hl ?? "id";
  const gl = opts.gl ?? "ID";
  const ceid = `${gl}:${hl}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; GustaftaResearch/1.0; +https://gustafta.com)",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Google News RSS ${res.status}`);

  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: NewsItem[] = [];

  $("item").each((_i, el) => {
    const $el = $(el);
    const title = $el.find("title").first().text().trim();
    const link = $el.find("link").first().text().trim();
    const pubDate = $el.find("pubDate").first().text().trim();
    const source = $el.find("source").first().text().trim();
    const descHtml = $el.find("description").first().text();
    let snippet = "";
    try {
      snippet = cheerio.load(descHtml || "").text().replace(/\s+/g, " ").trim();
    } catch {
      snippet = (descHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    if (title) {
      items.push({ title, link, source, pubDate, snippet: snippet.slice(0, 280) });
    }
  });

  return items.slice(0, opts.limit ?? 8);
}

/** Susun dokumen teks terstruktur dari kumpulan grup topik. */
function formatNewsDoc(label: string, groups: TopicGroup[]): string {
  const stamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const lines: string[] = [];
  lines.push(`FEED RISET — ${label}`);
  lines.push(`Diperbarui: ${stamp} WIB`);
  lines.push(
    "Sumber: Google News RSS (agregasi berita publik). Ini BUKAN pemantauan sosmed real-time.",
  );
  lines.push(
    "Gunakan sebagai sinyal awal; tandai angka/klaim yang belum terverifikasi dengan [ASUMSI: ... | basis: ... | verifikasi-ke: ...].",
  );
  lines.push("");

  for (const g of groups) {
    lines.push(`## Topik: ${g.query}`);
    if (g.items.length === 0) {
      lines.push("(tidak ada hasil)");
      lines.push("");
      continue;
    }
    g.items.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.title}`);
      const meta = [it.source, it.pubDate].filter(Boolean).join(" | ");
      if (meta) lines.push(`   Sumber: ${meta}`);
      if (it.snippet) lines.push(`   Ringkas: ${it.snippet}`);
      if (it.link) lines.push(`   Tautan: ${it.link}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Ingest dokumen feed ke KB milik satu agen.
 * Prune dulu feed lama (HANYA KB ber-prefix "Feed Riset") agar selalu segar & ringkas,
 * lalu buat KB baru + chunk (RAG). KB lain (mis. "Panduan Metode Riset" & unggahan user)
 * TIDAK tersentuh. Aman tanpa OPENAI (fallback concat di searchKnowledgeBase).
 */
export async function ingestNewsForAgent(
  agentId: number,
  label: string,
  doc: string,
): Promise<number> {
  const { db } = await import("../db");
  const { sql } = await import("drizzle-orm");

  await db.execute(sql`
    DELETE FROM knowledge_chunks
    WHERE knowledge_base_id IN (
      SELECT id FROM knowledge_bases
      WHERE agent_id = ${agentId} AND name LIKE ${FEED_KB_PREFIX + "%"}
    )
  `);
  await db.execute(sql`
    DELETE FROM knowledge_bases
    WHERE agent_id = ${agentId} AND name LIKE ${FEED_KB_PREFIX + "%"}
  `);

  const kb = await storage.createKnowledgeBase({
    agentId: String(agentId),
    name: `${FEED_KB_PREFIX} — ${label} (${new Date().toISOString().slice(0, 10)})`,
    type: "text",
    content: doc,
    description: "Auto-generated research feed (Google News RSS)",
    extractedText: doc,
    sourceUrl: "https://news.google.com",
    sourceAuthority: "Google News (agregator berita publik)",
    status: "active",
  });

  const chunks = await processKnowledgeBaseForRAG(
    parseInt(kb.id),
    agentId,
    doc,
    kb.name,
  );
  if (chunks.length > 0) {
    await storage.createChunks(chunks);
  }
  return chunks.length;
}

// ── Panduan Metode Riset (KB statis, playbook FB Ad Library + TikTok Shop) ────
function buildMethodLibraryDoc(): string {
  return `PANDUAN METODE RISET — Iklan, Produk Viral & Pasar
Dokumen ini adalah PLAYBOOK cara melakukan riset pasar mendalam. Dipakai bersama
Feed Riset harian (berita otomatis). Jujur: data langsung dari Facebook Ad Library &
TikTok umumnya via akses manual atau tool berbayar — bagian di bawah memandu langkahnya.

════════════════════════════════════════════════════════════════════
BAGIAN A — FACEBOOK / META AD LIBRARY (gratis, publik)
════════════════════════════════════════════════════════════════════
Apa: Perpustakaan iklan publik Meta — semua iklan aktif yang berjalan di Facebook &
Instagram bisa dilihat siapa saja. URL: https://www.facebook.com/ads/library
Referensi metode: https://www.revou.co/panduan-teknis/cara-melakukan-riset-untuk-facebook-ads-menggunakan-facebook-ad-library

Langkah riset kompetitor & iklan:
1. Buka Ad Library → pilih negara "Indonesia" → kategori "Semua iklan".
2. Cari nama kompetitor / kata kunci produk (mis. "sertifikasi SBU", "chatbot bisnis").
3. Lihat iklan yang AKTIF: makin lama sebuah iklan berjalan (cek tanggal mulai), makin
   besar kemungkinan iklan itu "menang" (profitable) → tiru pola angle/creative-nya.
4. Analisis: hook 3 detik pertama, format (video/gambar/carousel), penawaran (diskon/bonus),
   call-to-action, dan halaman tujuan (landing page).
5. Catat pola yang berulang antar kompetitor = formula pasar yang sudah terbukti.

Sinyal "iklan pemenang": banyak variasi creative dari 1 pengiklan, iklan berjalan >2-3
minggu, dan copy yang menyasar pain point spesifik.

Untuk otomasi penuh: butuh Meta Ad Library API (akses token + review aplikasi). Cakupan
iklan komersial non-politik di Indonesia terbatas lewat API → riset manual lebih andal.

════════════════════════════════════════════════════════════════════
BAGIAN B — TIKTOK: PRODUK & KONTEN VIRAL
════════════════════════════════════════════════════════════════════
Referensi tool riset produk TikTok Shop: https://www.bigseller.com/blog/articleDetails/4496/tools-tiktok-shop-riset-produk.htm

Sumber gratis:
1. TikTok Creative Center (https://ads.tiktok.com/business/creativecenter) — tren hashtag,
   lagu, dan iklan populer per negara (Indonesia). Gratis, tanpa iklan berbayar.
2. Pencarian TikTok: cari kata kunci niche → urutkan "Suka/Views" → catat video dengan
   engagement tertinggi (viral).
3. TikTok Shop: lihat kategori "Terlaris" / "Flash Sale" untuk produk yang sedang naik.

Yang dicatat: produk yang muncul berulang, hook video, gaya konten (review/demo/storytelling),
harga, dan volume komentar (indikasi minat).

Tool berbayar (opsional, lebih dalam): BigSeller, Kalodata, EchoTik, Shoplus — untuk data
penjualan/estimasi omzet. Bukan keharusan untuk mulai.

════════════════════════════════════════════════════════════════════
BAGIAN C — CARA PAKAI UNTUK GUSTAFTA
════════════════════════════════════════════════════════════════════
PENGUATAN PRODUK (80 claw premium): temuan pain point domain (konstruksi/sertifikasi/legal)
→ usulan claw mana yang perlu diperkuat / fitur baru / claw baru.
PENGUATAN PASAR: temuan angle iklan & produk viral → usulan sudut kampanye, hook konten,
dan penawaran untuk menjual chatbot premium & jasa Gustafta.

Selalu bedakan FAKTA (dari sumber) vs ASUMSI. Tandai asumsi:
[ASUMSI: {nilai} | basis: {sumber/heuristik} | verifikasi-ke: {pihak}].`;
}

/**
 * Pastikan agen "riset-iklan-pasar" punya KB playbook metode riset (idempoten).
 * KB ini STATIS & TIDAK ikut ter-prune oleh sweep harian (prefix beda dari feed).
 * Embedding dibuat di sini (dijalankan di server env yang punya OpenAI key).
 */
export async function ensureResearchMethodLibrary(agentId: number): Promise<{ created: boolean; chunks: number }> {
  const { db } = await import("../db");
  const { sql } = await import("drizzle-orm");

  const existing = await db.execute(sql`
    SELECT id FROM knowledge_bases
    WHERE agent_id = ${agentId} AND name LIKE ${METHOD_KB_PREFIX + "%"}
    LIMIT 1
  `);
  const rows = (existing as any).rows ?? existing;
  if (Array.isArray(rows) && rows.length > 0) {
    return { created: false, chunks: 0 };
  }

  const doc = buildMethodLibraryDoc();
  const kb = await storage.createKnowledgeBase({
    agentId: String(agentId),
    name: `${METHOD_KB_PREFIX} — Iklan & Pasar`,
    type: "text",
    content: doc,
    description: "Playbook riset FB Ad Library & TikTok (statis)",
    extractedText: doc,
    sourceUrl: "https://www.facebook.com/ads/library",
    sourceAuthority: "Playbook internal Gustafta (metode riset)",
    status: "active",
  });

  const chunks = await processKnowledgeBaseForRAG(parseInt(kb.id), agentId, doc, kb.name);
  if (chunks.length > 0) {
    await storage.createChunks(chunks);
  }
  return { created: true, chunks: chunks.length };
}

export interface StreamResult {
  slug: string;
  agentId: number;
  topics: number;
  items: number;
  chunks: number;
}

export interface SweepResult {
  streams: StreamResult[];
  methodLibrary?: { agentId: number; created: boolean; chunks: number };
  skipped: string[];
  // Kompatibilitas mundur (kode/UI lama yang membaca .local / .global).
  local?: StreamResult;
  global?: StreamResult;
}

/**
 * Jalankan satu putaran riset untuk SEMUA stream feed. Resolusi agen via SLUG
 * (bukan ID hardcoded). Juga memastikan playbook metode riset ter-seed sekali.
 */
export async function runResearchSweep(): Promise<SweepResult> {
  const result: SweepResult = { streams: [], skipped: [] };

  for (const stream of FEED_STREAMS) {
    const agent = await storage.getAgentBySlug(stream.slug);
    if (!agent) {
      result.skipped.push(stream.slug);
      continue;
    }
    const agentId = Number(agent.id);
    const groups: TopicGroup[] = [];
    for (const t of stream.topics) {
      const q = typeof t === "string" ? t : t.q;
      const hl = typeof t === "string" ? stream.defaultHl : t.hl ?? stream.defaultHl;
      const gl = typeof t === "string" ? stream.defaultGl : t.gl ?? stream.defaultGl;
      try {
        groups.push({ query: q, items: await fetchGoogleNews(q, { hl, gl, limit: stream.perTopic ?? 8 }) });
      } catch (e) {
        console.error(`[ResearchFeed] "${stream.slug}" topik "${q}" gagal:`, (e as Error).message);
        groups.push({ query: q, items: [] });
      }
    }
    const doc = formatNewsDoc(stream.docTitle, groups);
    const chunks = await ingestNewsForAgent(agentId, stream.kbLabel, doc);
    const sr: StreamResult = {
      slug: stream.slug,
      agentId,
      topics: stream.topics.length,
      items: groups.reduce((a, g) => a + g.items.length, 0),
      chunks,
    };
    result.streams.push(sr);
    if (stream.slug === RESEARCH_LOCAL_SLUG) result.local = sr;
    if (stream.slug === RESEARCH_GLOBAL_SLUG) result.global = sr;

    // Seed playbook metode riset pada agen iklan-pasar (idempoten).
    if (stream.slug === RESEARCH_MARKET_SLUG) {
      try {
        result.methodLibrary = { agentId, ...(await ensureResearchMethodLibrary(agentId)) };
      } catch (e) {
        console.error(`[ResearchFeed] seed method library gagal:`, (e as Error).message);
      }
    }
  }

  return result;
}
