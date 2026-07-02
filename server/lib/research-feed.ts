import * as cheerio from "cheerio";
import { storage } from "../storage";
import { processKnowledgeBaseForRAG } from "./rag-service";

// ─────────────────────────────────────────────────────────────────────────────
// RESEARCH FEED — memberi "mata" nyata kepada tim riset.
// Sumber: Google News RSS (agregasi berita publik, GRATIS, tanpa API key).
// Hasil di-ingest ke Knowledge Base agen riset sehingga terambil saat chat (RAG).
// Jujur-by-design: ini agregasi berita publik, BUKAN scraping sosmed real-time.
// ─────────────────────────────────────────────────────────────────────────────

export const RESEARCH_LOCAL_SLUG = "riset-viral-lokal";
export const RESEARCH_GLOBAL_SLUG = "riset-tren-global";

const FEED_KB_PREFIX = "Feed Riset";

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

// Topik default relevan dengan core bisnis Gustafta (pengadaan/konstruksi/AI bisnis).
export const DEFAULT_LOCAL_TOPICS: string[] = [
  "tender konstruksi Indonesia",
  "pengadaan barang jasa pemerintah LKPP",
  "sertifikasi badan usaha SBU konstruksi",
  "sertifikat kompetensi kerja SKK konstruksi",
  "UMKM digitalisasi AI Indonesia",
  "chatbot AI untuk bisnis Indonesia",
];

export const DEFAULT_GLOBAL_TOPICS: string[] = [
  "AI agents for small business",
  "vertical AI SaaS startup",
  "AI automation for SMB",
  "construction technology AI",
  "no-code AI assistant builder",
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
 * Prune dulu feed lama (hanya KB ber-prefix "Feed Riset") agar selalu segar & ringkas,
 * lalu buat KB baru + chunk (RAG). Aman tanpa OPENAI (fallback concat di searchKnowledgeBase).
 */
export async function ingestNewsForAgent(
  agentId: number,
  label: string,
  doc: string,
): Promise<number> {
  const { db } = await import("../db");
  const { sql } = await import("drizzle-orm");

  // Prune HANYA data feed lama milik agen ini (jangan sentuh KB lain yg mungkin diunggah user).
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

export interface SweepResult {
  local?: { topics: number; items: number; chunks: number; agentId: number };
  global?: { topics: number; items: number; chunks: number; agentId: number };
  skipped: string[];
}

/**
 * Jalankan satu putaran riset: ambil berita untuk agen feed lokal & global,
 * lalu ingest ke KB masing-masing. Resolusi agen via SLUG (bukan ID hardcoded).
 */
export async function runResearchSweep(opts?: {
  localTopics?: string[];
  globalTopics?: string[];
}): Promise<SweepResult> {
  const result: SweepResult = { skipped: [] };

  const localAgent = await storage.getAgentBySlug(RESEARCH_LOCAL_SLUG);
  const globalAgent = await storage.getAgentBySlug(RESEARCH_GLOBAL_SLUG);

  if (localAgent) {
    const topics = opts?.localTopics ?? DEFAULT_LOCAL_TOPICS;
    const groups: TopicGroup[] = [];
    for (const q of topics) {
      try {
        groups.push({ query: q, items: await fetchGoogleNews(q, { hl: "id", gl: "ID", limit: 8 }) });
      } catch (e) {
        console.error(`[ResearchFeed] lokal "${q}" gagal:`, (e as Error).message);
        groups.push({ query: q, items: [] });
      }
    }
    const doc = formatNewsDoc("Isu & Pain Point Lokal (Indonesia)", groups);
    const chunks = await ingestNewsForAgent(Number(localAgent.id), "Lokal (Indonesia)", doc);
    result.local = {
      topics: topics.length,
      items: groups.reduce((a, g) => a + g.items.length, 0),
      chunks,
      agentId: Number(localAgent.id),
    };
  } else {
    result.skipped.push(RESEARCH_LOCAL_SLUG);
  }

  if (globalAgent) {
    const topics = opts?.globalTopics ?? DEFAULT_GLOBAL_TOPICS;
    const groups: TopicGroup[] = [];
    for (const q of topics) {
      try {
        groups.push({ query: q, items: await fetchGoogleNews(q, { hl: "en", gl: "US", limit: 8 }) });
      } catch (e) {
        console.error(`[ResearchFeed] global "${q}" gagal:`, (e as Error).message);
        groups.push({ query: q, items: [] });
      }
    }
    const doc = formatNewsDoc("Tren Global / Luar Negeri", groups);
    const chunks = await ingestNewsForAgent(Number(globalAgent.id), "Global (Luar Negeri)", doc);
    result.global = {
      topics: topics.length,
      items: groups.reduce((a, g) => a + g.items.length, 0),
      chunks,
      agentId: Number(globalAgent.id),
    };
  } else {
    result.skipped.push(RESEARCH_GLOBAL_SLUG);
  }

  return result;
}
