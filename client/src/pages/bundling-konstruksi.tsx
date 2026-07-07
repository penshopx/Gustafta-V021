import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SharedHeader } from "@/components/shared-header";
import {
  HardHat, Award, Building2, FileSearch, Layers, Mountain, ShieldCheck, Ruler,
  ArrowRight, Sparkles, Gift, Briefcase, Truck, BadgeCheck, Landmark,
  Workflow, Boxes, GitBranch, ClipboardCheck, Users,
} from "lucide-react";

/*
 * Halaman perkenalan / bundling untuk soft-launch Indobuildtech 2026.
 * Mengelompokkan chatbot yang SUDAH ADA di Gustafta menurut PROFESI peserta
 * (SKK, SBU, Kontraktor, Konsultan, Suplier, LSP, LSBU) + memperagakan 3
 * kemampuan organisasi AI (Agentic, MultiClaw, OpenClaw). Semua href menaut
 * ke rute nyata di platform — tidak ada yang dibuat baru.
 */

type Claw = { name: string; tag: string; href: string; icon: any };
type Group = { key: string; title: string; audience: string; icon: any; accent: string; claws: Claw[] };

const GROUPS: Group[] = [
  {
    key: "skk",
    title: "SKK — Tenaga Ahli & Kompetensi",
    audience: "Untuk pemegang / calon pemegang Sertifikat Kompetensi Kerja.",
    icon: Award,
    accent: "text-teal-600 dark:text-teal-400",
    claws: [
      { name: "SKKClaw", tag: "Coach kompetensi & jenjang SKK", href: "/skk-coach", icon: Award },
      { name: "GeoteknikClaw", tag: "SKK Sipil — Geoteknik", href: "/geoteknik-claw", icon: Mountain },
      { name: "SafiraClaw", tag: "SKK K3 Konstruksi", href: "/safira-claw", icon: ShieldCheck },
      { name: "ManprojakClaw", tag: "Manajemen proyek konstruksi", href: "/manprojak-claw", icon: ClipboardCheck },
    ],
  },
  {
    key: "sbu",
    title: "SBU — Badan Usaha",
    audience: "Untuk BUJK yang mengurus / merawat Sertifikat Badan Usaha.",
    icon: Building2,
    accent: "text-amber-600 dark:text-amber-400",
    claws: [
      { name: "SBUClaw", tag: "Sertifikat Badan Usaha (BUJK)", href: "/sbu-claw", icon: Building2 },
      { name: "SkemaClaw", tag: "Skema & subklasifikasi SBU", href: "/skema-claw", icon: Layers },
      { name: "PanduanSBU", tag: "Panduan langkah pengurusan SBU", href: "/panduan-sbu", icon: FileSearch },
    ],
  },
  {
    key: "kontraktor",
    title: "Kontraktor",
    audience: "Untuk pelaksana konstruksi yang mengejar & menang tender.",
    icon: HardHat,
    accent: "text-orange-600 dark:text-orange-400",
    claws: [
      { name: "KontraktorBot", tag: "Asisten intelijen kontraktor", href: "/kontraktorbot", icon: HardHat },
      { name: "KonstraClaw", tag: "War-room strategi proyek", href: "/konstra-claw", icon: Layers },
      { name: "TenderaClaw", tag: "Dokumen & strategi tender", href: "/tendera-claw", icon: FileSearch },
    ],
  },
  {
    key: "konsultan",
    title: "Konsultan",
    audience: "Untuk perencana, pengawas, dan konsultan teknis.",
    icon: Ruler,
    accent: "text-indigo-600 dark:text-indigo-400",
    claws: [
      { name: "KonsultanBot", tag: "Asisten intelijen konsultan", href: "/konsultanbot", icon: Briefcase },
      { name: "ArsitekturClaw", tag: "Perencanaan & desain arsitektur", href: "/arsitektur-claw", icon: Ruler },
    ],
  },
  {
    key: "suplier",
    title: "Suplier",
    audience: "Untuk pemasok material & rantai pasok konstruksi.",
    icon: Truck,
    accent: "text-emerald-600 dark:text-emerald-400",
    claws: [
      { name: "SupplierBot", tag: "Asisten intelijen suplier", href: "/supplierbot", icon: Truck },
      { name: "SupplyChainClaw", tag: "Manajemen rantai pasok", href: "/supply-chain-claw", icon: Boxes },
    ],
  },
  {
    key: "lsp",
    title: "LSP — Lembaga Sertifikasi Profesi",
    audience: "Untuk pengelola LSP & TUK (sertifikasi kompetensi).",
    icon: BadgeCheck,
    accent: "text-sky-600 dark:text-sky-400",
    claws: [
      { name: "Lisensi LSP BNSP", tag: "Pendirian & lisensi LSP ke BNSP", href: "/lisensi-lsp-bnsp", icon: BadgeCheck },
      { name: "Manajemen LSP & TUK", tag: "Operasional LSP dan TUK", href: "/manajemen-lsp-tuk", icon: ClipboardCheck },
    ],
  },
  {
    key: "lsbu",
    title: "LSBU — Lembaga Sertifikasi Badan Usaha",
    audience: "Untuk pengelola LSBU (sertifikasi badan usaha).",
    icon: Landmark,
    accent: "text-rose-600 dark:text-rose-400",
    claws: [
      { name: "ABUClaw", tag: "Akreditasi & operasional LSBU", href: "/abu-claw", icon: Landmark },
    ],
  },
];

/* Peragaan 3 kemampuan organisasi AI — menaut ke fitur nyata. */
const CAPABILITIES = [
  {
    name: "Agentic",
    icon: Workflow,
    accent: "text-indigo-600 dark:text-indigo-400",
    ring: "hover:border-indigo-300 dark:hover:border-indigo-700",
    headline: "Satu chatbot, satu tim di belakangnya",
    desc: "Bukan sekadar menjawab. Satu orkestrator berpikir bertahap, memanggil beberapa sub-agen spesialis secara paralel, lalu merangkum satu jawaban utuh. Perhatikan titik-titik sub-agen menyala saat bekerja.",
    href: "/konstra-claw",
    cta: "Lihat orkestrasi langsung",
  },
  {
    name: "MultiClaw",
    icon: Boxes,
    accent: "text-emerald-600 dark:text-emerald-400",
    ring: "hover:border-emerald-300 dark:hover:border-emerald-700",
    headline: "Puluhan 'departemen AI' siap pakai",
    desc: "Kumpulan Claw per bidang — konstruksi, tender, K3, badan usaha, dan lainnya. Tiap Claw adalah satu departemen berisi banyak sub-agen. Pilih yang sesuai kebutuhan, langsung pakai tanpa merakit.",
    href: "/multiclaw-suite",
    cta: "Jelajahi katalog Claw",
  },
  {
    name: "OpenClaw",
    icon: GitBranch,
    accent: "text-orange-600 dark:text-orange-400",
    ring: "hover:border-orange-300 dark:hover:border-orange-700",
    headline: "Rakit tim agen Anda sendiri",
    desc: "Ubah cara kerja Anda menjadi tim agen AI kustom (Trilogi). Tentukan peran, alur, dan gerbang keputusan manusia — lalu jalankan sebagai satu organisasi kecil yang bekerja untuk Anda.",
    href: "/tutor-builder",
    cta: "Rakit tim agen",
  },
];

export default function BundlingKonstruksiPage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Bundling Chatbot Konstruksi — Perkenalan Indobuildtech 2026 | Gustafta";
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background" data-testid="page-bundling-konstruksi">
      <SharedHeader />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-800 via-indigo-800 to-blue-800 px-4 py-12 md:py-16">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-0" data-testid="badge-bundling">
              <HardHat className="h-3.5 w-3.5 mr-1" /> Perkenalan Indobuildtech 2026
            </Badge>
            <Badge variant="outline" className="border-white/40 text-white bg-white/10">
              <Gift className="h-3.5 w-3.5 mr-1" /> Bonus peserta
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
            Bundling Chatbot untuk Insan Jasa Konstruksi
          </h1>
          <p className="text-blue-100 text-base md:text-lg max-w-2xl">
            Dirakit khusus untuk peserta: Profesional Jasa Konstruksi, Kontraktor, Suplier, Konsultan,
            dan lembaga terkait. Pilih sesuai profesi Anda, lalu lihat bagaimana chatbot Gustafta bekerja
            sebagai <span className="font-semibold text-white">organisasi AI</span> — bukan sekadar tanya-jawab.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white gap-2" data-testid="button-mulai-bonus">
              <Link href="/bonus-indobuildtech">
                <Sparkles className="h-4 w-4" /> Mulai Jalur Bonus Peserta
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 border-white/40 text-white bg-white/10 hover:bg-white/20 hover:text-white" data-testid="button-back-event">
              <Link href="/indobuildtech">Kembali ke Halaman Event</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Bagian 1 — Bundling per profesi */}
      <section className="max-w-5xl mx-auto px-4 py-12 space-y-10">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
            Pilih menurut profesi Anda
          </h2>
        </div>

        {GROUPS.map((g) => (
          <div key={g.key} data-testid={`group-${g.key}`}>
            <div className="mb-4 flex items-start gap-3">
              <div className={`mt-0.5 rounded-lg bg-gray-100 dark:bg-white/5 p-2 ${g.accent}`}>
                <g.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{g.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{g.audience}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.claws.map((c) => (
                <Link key={c.name} href={c.href} className="group" data-testid={`link-claw-${c.name.toLowerCase().replace(/\s+/g, "-")}`}>
                  <Card className="h-full transition-all hover:shadow-lg border-2 border-transparent hover:border-indigo-300 dark:hover:border-indigo-700">
                    <CardContent className="pt-6 space-y-2">
                      <c.icon className={`h-7 w-7 ${g.accent}`} />
                      <h4 className="font-bold text-gray-900 dark:text-white">{c.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{c.tag}</p>
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${g.accent}`}>
                        Coba <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Bagian 2 — Peragaan kemampuan organisasi AI */}
      <section className="bg-white dark:bg-white/5 border-y border-gray-200 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
                Bukan chatbot biasa — ini organisasi AI
              </h2>
            </div>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              Setiap chatbot di atas ditopang tiga kemampuan inti Gustafta. Coba peragaannya langsung.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {CAPABILITIES.map((cap) => (
              <Card key={cap.name} className={`h-full flex flex-col border-2 border-transparent transition-all hover:shadow-lg ${cap.ring}`} data-testid={`card-capability-${cap.name.toLowerCase()}`}>
                <CardContent className="pt-6 flex flex-col h-full space-y-3">
                  <cap.icon className={`h-8 w-8 ${cap.accent}`} />
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white">{cap.name}</h3>
                    <p className={`text-sm font-medium ${cap.accent}`}>{cap.headline}</p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">{cap.desc}</p>
                  <Button asChild variant="outline" className="gap-2 w-full mt-2" data-testid={`button-capability-${cap.name.toLowerCase()}`}>
                    <Link href={cap.href}>
                      {cap.cta} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Penutup */}
      <section className="max-w-5xl mx-auto px-4 py-12 space-y-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-6 flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-gray-900 dark:text-white">Punya kode peserta?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Aktifkan kode bonus untuk membuka akses penuh, lalu rakit chatbot pertama Anda dari pengalaman kerja.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" data-testid="button-kode-akses">
                <Link href="/kode-akses">Aktifkan Kode</Link>
              </Button>
              <Button asChild variant="outline" className="gap-2" data-testid="button-rakit-agen">
                <Link href="/blueprint-builder?preset=konstruksi">
                  <Sparkles className="h-4 w-4" /> Rakit AI dari Pengalaman Anda
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Sebagian asisten AI memerlukan akun & paket aktif — akses penuh terbuka lewat kode bonus peserta menjelang acara.
        </p>
      </section>
    </div>
  );
}
