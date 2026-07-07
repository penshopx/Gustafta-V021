import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SharedHeader } from "@/components/shared-header";
import {
  Stethoscope, FileCheck2, Gavel, HardHat, Briefcase, Truck, Award, Building2,
  ArrowRight, MessageCircle, Headset, CheckCircle2, Clock, Sparkles, Bot,
  TrendingUp, GraduationCap, ShieldQuestion,
} from "lucide-react";

/*
 * Klinik Konsultasi Konstruksi — "ruang tunggu" konsultasi berbasis AI.
 * Pengunjung masuk, memilih loket (chatbot yang SUDAH ADA), AI menjawab lebih
 * dulu; operator manusia hanya menangani hal yang tak bisa dijawab AI (fallback
 * WhatsApp memakai kontak konsultasi resmi yang sudah dipakai di seluruh app).
 */

const OPERATOR_WA =
  "https://wa.me/6282299417818?text=" +
  encodeURIComponent(
    "Halo Operator Gustafta, pertanyaan saya di Klinik Konsultasi belum terjawab AI. Mohon bantuannya.",
  );

type Loket = { name: string; tag: string; href: string; icon: any; accent: string };

const LOKET: Loket[] = [
  { name: "Loket Perizinan (OSS)", tag: "NIB, izin berusaha, OSS-RBA", href: "/perijinanbot", icon: FileCheck2, accent: "text-cyan-600 dark:text-cyan-400" },
  { name: "Loket Tender", tag: "Syarat, dokumen & strategi tender", href: "/tenderbot", icon: Gavel, accent: "text-violet-600 dark:text-violet-400" },
  { name: "Loket Pelaksanaan Proyek", tag: "EVM, K3, LHP, klaim, serah terima", href: "/proyekbot", icon: HardHat, accent: "text-orange-600 dark:text-orange-400" },
  { name: "Loket Kontraktor", tag: "Operasional BUJK & intelijen", href: "/kontraktorbot", icon: HardHat, accent: "text-amber-600 dark:text-amber-400" },
  { name: "Loket Konsultan", tag: "Perencanaan, pengawasan, desain", href: "/konsultanbot", icon: Briefcase, accent: "text-indigo-600 dark:text-indigo-400" },
  { name: "Loket Suplier", tag: "Rantai pasok & pasok material", href: "/supplierbot", icon: Truck, accent: "text-emerald-600 dark:text-emerald-400" },
  { name: "Loket SKK", tag: "Kompetensi & jenjang tenaga ahli", href: "/skk-coach", icon: Award, accent: "text-teal-600 dark:text-teal-400" },
  { name: "Loket SBU", tag: "Sertifikat badan usaha (BUJK)", href: "/sbu-claw", icon: Building2, accent: "text-rose-600 dark:text-rose-400" },
  { name: "Loket PUB (LKUT)", tag: "Pengembangan usaha berkelanjutan & LKUT", href: "/pub-lkut-claw", icon: TrendingUp, accent: "text-sky-600 dark:text-sky-400" },
  { name: "Loket PKB", tag: "Pengembangan keprofesian berkelanjutan", href: "/pkb", icon: GraduationCap, accent: "text-violet-600 dark:text-violet-400" },
];

type WorkroomLink = { domain: string; name: string; tag: string; icon: any };

const WORKROOM_LINKS: WorkroomLink[] = [
  { domain: "sbu", name: "Workroom SBU", tag: "Kesiapan Sertifikat Badan Usaha", icon: Building2 },
  { domain: "skk", name: "Workroom SKK", tag: "Kesiapan sertifikasi kompetensi", icon: Award },
  { domain: "pub", name: "Workroom PUB (LKUT)", tag: "Laporan kegiatan usaha tahunan", icon: TrendingUp },
  { domain: "pkb", name: "Workroom PKB", tag: "Pengembangan keprofesian berkelanjutan", icon: GraduationCap },
  { domain: "perizinan", name: "Workroom Perizinan", tag: "Kesiapan izin berusaha (OSS)", icon: FileCheck2 },
  { domain: "tender", name: "Workroom Tender", tag: "Kelayakan & win probability tender", icon: Gavel },
];

const STEPS = [
  { icon: Stethoscope, title: "1. Pilih loket", desc: "Tentukan topik konsultasi Anda." },
  { icon: Bot, title: "2. Tanya ke AI", desc: "Chatbot menjawab langsung, kapan saja." },
  { icon: Headset, title: "3. Operator bila perlu", desc: "Yang tak terjawab AI diteruskan ke operator." },
];

export default function KlinikKonsultasiPage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Klinik Konsultasi Konstruksi — Tanya AI Dulu, Operator Bila Perlu | Gustafta";
    return () => { document.title = prevTitle; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background" data-testid="page-klinik-konsultasi">
      <SharedHeader />

      {/* Hero / Landing */}
      <section className="bg-gradient-to-br from-teal-800 via-cyan-800 to-blue-900 px-4 py-12 md:py-16">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-teal-500 hover:bg-teal-500 text-white border-0" data-testid="badge-klinik">
              <Stethoscope className="h-3.5 w-3.5 mr-1" /> Klinik Konsultasi
            </Badge>
            <Badge variant="outline" className="border-white/40 text-white bg-white/10">
              <Clock className="h-3.5 w-3.5 mr-1" /> Buka 24 jam
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
            Klinik Konsultasi Konstruksi
          </h1>
          <p className="text-teal-50 text-base md:text-lg max-w-2xl">
            Masuk, pilih loket, dan berkonsultasi dengan chatbot AI yang siap menjawab kapan saja.
            <span className="font-semibold text-white"> Operator manusia hanya turun tangan</span> untuk
            hal yang tidak bisa dijawab AI — jadi Anda tak perlu antre untuk pertanyaan umum.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild size="lg" className="bg-white text-teal-800 hover:bg-teal-50 gap-2" data-testid="button-masuk-loket">
              <a href="#loket"><Sparkles className="h-4 w-4" /> Masuk & Pilih Loket</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 border-white/40 text-white bg-white/10 hover:bg-white/20 hover:text-white" data-testid="button-operator-hero">
              <a href={OPERATOR_WA} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> Hubungi Operator
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Cara kerja */}
      <section className="max-w-5xl mx-auto px-4 pt-10">
        <div className="grid sm:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <Card key={s.title} className="border-dashed" data-testid={`step-${s.title.charAt(0)}`}>
              <CardContent className="pt-6 flex items-start gap-3">
                <div className="rounded-lg bg-teal-100 dark:bg-teal-900/40 p-2 text-teal-600 dark:text-teal-400 shrink-0">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">{s.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Loket */}
      <section id="loket" className="max-w-5xl mx-auto px-4 py-12 space-y-6">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
            Pilih loket konsultasi
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOKET.map((l) => (
            <Link key={l.name} href={l.href} className="group" data-testid={`link-loket-${l.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
              <Card className="h-full transition-all hover:shadow-lg border-2 border-transparent hover:border-teal-300 dark:hover:border-teal-700">
                <CardContent className="pt-6 space-y-2">
                  <l.icon className={`h-7 w-7 ${l.accent}`} />
                  <h3 className="font-bold text-gray-900 dark:text-white">{l.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{l.tag}</p>
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${l.accent}`}>
                    Mulai konsultasi <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Jembatan ke Workroom — dari konsultasi ke tindakan bertahap */}
      <section className="max-w-5xl mx-auto px-4 pb-2 space-y-5">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
            Sudah konsultasi? Lanjut ke Workroom
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
          Workroom adalah ruang kerja bertahap: AI menganalisis kelayakan &amp; kesiapan berkas Anda,
          lalu setiap keputusan penting melewati{" "}
          <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
            <ShieldQuestion className="h-3.5 w-3.5" /> gerbang persetujuan manusia ◆
          </span>
          . Pilih bidang untuk mulai menggarap kasus Anda (perlu login).
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WORKROOM_LINKS.map((w) => (
            <Link key={w.domain} href={`/workroom?domain=${w.domain}`} className="group" data-testid={`link-workroom-${w.domain}`}>
              <Card className="h-full transition-all hover:shadow-md border-2 border-transparent hover:border-emerald-300 dark:hover:border-emerald-700">
                <CardContent className="pt-5 pb-5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <w.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-bold text-gray-900 dark:text-white">{w.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{w.tag}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Buka Workroom <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Operator fallback */}
      <section className="max-w-5xl mx-auto px-4 pt-12 pb-14">
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/30 border-teal-200 dark:border-teal-800">
          <CardContent className="pt-6 flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-teal-100 dark:bg-teal-900/40 p-2.5 text-teal-600 dark:text-teal-400 shrink-0">
                <Headset className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-gray-900 dark:text-white">Belum terjawab AI? Operator siap bantu</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl">
                  Operator kami fokus melayani konfirmasi & kasus khusus yang tidak bisa dijawab chatbot —
                  bukan pertanyaan umum yang sudah bisa dijawab AI di loket.
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-1">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> Konfirmasi keputusan / verifikasi dokumen</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> Kasus khusus di luar cakupan chatbot</li>
                </ul>
              </div>
            </div>
            <Button asChild size="lg" className="bg-teal-600 hover:bg-teal-500 text-white gap-2 shrink-0" data-testid="button-operator-fallback">
              <a href={OPERATOR_WA} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> Hubungi Operator (WhatsApp)
              </a>
            </Button>
          </CardContent>
        </Card>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          Sebagian chatbot memerlukan akun & paket aktif — akses penuh terbuka lewat kode bonus peserta menjelang acara.
        </p>
      </section>
    </div>
  );
}
