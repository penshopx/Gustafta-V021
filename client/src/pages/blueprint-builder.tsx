import { useState } from "react";
import { Link, useLocation } from "wouter";
import { SharedHeader } from "@/components/shared-header";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, ArrowRight, ArrowLeft, Loader2, Lock, Check, AlertTriangle,
  Brain, Target, ClipboardList, Rocket, RotateCcw, Info, Gauge,
} from "lucide-react";

/* ── Types (mirror server/blueprint-engine-routes.ts responses) ───────────── */
type InputType = "text" | "textarea" | "select" | "multiselect" | "boolean" | "number" | "list";

interface DialogueQuestion {
  id: string;
  module: string;
  field: string;
  priority: number;
  question: string;
  why?: string;
  inputType: InputType;
  options?: { value: string; label: string }[];
}
interface DialogueState {
  totalEssential: number;
  answeredEssential: number;
  remainingEssential: number;
  essentialComplete: boolean;
  nextQuestions: DialogueQuestion[];
}
interface ConfidenceReport {
  overallConfidence: number;
  overallCompletion: number;
  coreReady: boolean;
  weakestFields: { module: string; field: string; confidence: number }[];
  missingRequired: { module: string; field: string }[];
}
interface GapReport {
  readyToApply: boolean;
  blockingCount: number;
  nextActions: string[];
}
interface CritiqueReport {
  overallScore: number;
  grade: string;
  summary: string;
  findings: { dimension: string; kind: string; message: string; recommendation?: string }[];
}
interface SimulationReport {
  coverage: number;
  readyCount: number;
  partialCount: number;
  unreadyCount: number;
  summary: string;
}
interface AnalyzeResponse {
  confidence: ConfidenceReport;
  gaps: GapReport;
  critique: CritiqueReport;
  simulation: SimulationReport;
}
interface ConfigureResult {
  applied: boolean;
  dryRun: boolean;
  mode: "create" | "update";
  agentId?: string;
  agentPatchKeys: string[];
  created: { knowledgeBases: number; miniApps: number; integrations: number; projectBrainTemplates: number };
  warnings: string[];
}

type Step = "intro" | "dialogue" | "analyze" | "done";

const pct = (n: number) => Math.round((n || 0) * 100);

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function BlueprintBuilderPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("intro");
  const [intent, setIntent] = useState("");
  const [blueprint, setBlueprint] = useState<any>(null);
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceReport | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [preview, setPreview] = useState<ConfigureResult | null>(null);
  const [created, setCreated] = useState<ConfigureResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setLocation] = useLocation();

  /* Buka agen yang baru dibuat langsung di Builder (Dashboard): aktifkan lalu navigasi. */
  const openInBuilder = async () => {
    const agentId = created?.agentId;
    if (!agentId) { setLocation("/dashboard"); return; }
    setBusy(true);
    try {
      await apiRequest("POST", `/api/agents/${agentId}/activate`);
      setLocation("/dashboard");
    } catch (e: any) {
      toast({ title: "Gagal membuka Builder", description: e?.message || "Buka manual dari Dashboard.", variant: "destructive" });
      setLocation("/dashboard");
    } finally { setBusy(false); }
  };

  /* ── API helpers ── */
  const start = async () => {
    setBusy(true);
    try {
      const data = await apiRequest("POST", "/api/blueprint/start", { intent: intent.trim() || undefined });
      setBlueprint(data.blueprint);
      setDialogue(data.dialogue);
      setConfidence(data.confidence);
      setAnswers({});
      setStep("dialogue");
    } catch (e: any) {
      toast({ title: "Gagal memulai", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const submitAnswers = async () => {
    if (!blueprint || !dialogue) return;
    const payload: Record<string, any> = {};
    for (const q of dialogue.nextQuestions) {
      const v = answers[q.id];
      // Boolean: only submit if the user actually toggled it (untouched stays undefined).
      if (q.inputType === "boolean") { if (typeof v === "boolean") payload[q.id] = v; continue; }
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      payload[q.id] = v;
    }
    if (Object.keys(payload).length === 0) {
      toast({ title: "Belum ada jawaban", description: "Isi minimal satu pertanyaan atau lanjut ke analisis.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const data = await apiRequest("POST", "/api/blueprint/answer", { blueprint, answers: payload });
      setBlueprint(data.blueprint);
      setDialogue(data.dialogue);
      setConfidence(data.confidence);
      setAnswers({});
      if (data.warnings?.length) {
        toast({ title: "Catatan", description: data.warnings.slice(0, 2).join(" · ") });
      }
    } catch (e: any) {
      toast({ title: "Gagal menyimpan jawaban", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const runAnalyze = async () => {
    if (!blueprint) return;
    setBusy(true);
    try {
      const data = await apiRequest("POST", "/api/blueprint/analyze", { blueprint });
      setAnalysis(data);
      setPreview(null);
      setStep("analyze");
    } catch (e: any) {
      toast({ title: "Gagal menganalisis", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const previewConfigure = async () => {
    if (!blueprint) return;
    setBusy(true);
    try {
      const data = await apiRequest("POST", "/api/blueprint/configure", { blueprint, mode: "create", dryRun: true });
      setPreview(data);
    } catch (e: any) {
      toast({ title: "Gagal pratinjau", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const confirmCreate = async () => {
    if (!blueprint) return;
    setBusy(true);
    try {
      const data = await apiRequest("POST", "/api/blueprint/configure", { blueprint, mode: "create", dryRun: false });
      setCreated(data);
      setStep("done");
    } catch (e: any) {
      toast({ title: "Gagal membuat agen", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const reset = () => {
    setStep("intro"); setIntent(""); setBlueprint(null); setDialogue(null);
    setConfidence(null); setAnswers({}); setAnalysis(null); setPreview(null); setCreated(null);
  };

  /* ── Auth gate ── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-background">
        <SharedHeader />
        <div className="flex items-center justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white dark:bg-background">
        <SharedHeader />
        <div className="max-w-md mx-auto text-center py-24 px-4" data-testid="gate-login">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mx-auto mb-5">
            <Lock className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Masuk untuk Merancang Agen</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Blueprint Builder membuat & mengonfigurasi agen di akun Anda, jadi perlu login dulu.</p>
          <Link href="/login">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" data-testid="btn-login">
              Masuk <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  /* ── Header progress ── */
  const dPct = dialogue ? Math.round((dialogue.answeredEssential / Math.max(1, dialogue.totalEssential)) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background" data-testid="page-blueprint-builder">
      <SharedHeader />

      {/* Hero strip */}
      <div className="bg-gradient-to-br from-indigo-700 via-blue-700 to-cyan-700 px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" /> Blueprint Builder
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Rancang Agen AI lewat Dialog Terpandu</h1>
          <p className="text-sm text-blue-100">Jawab beberapa pertanyaan inti — mesin Blueprint menyimpulkan sisanya, menilai keyakinan, lalu menyiapkan konfigurasi agen Anda.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── STEP: INTRO ── */}
        {step === "intro" && (
          <div className="rounded-2xl border bg-white dark:bg-card p-6 space-y-4" data-testid="step-intro">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Mulai dari Ide Besar</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tuliskan tujuan utama asisten yang ingin Anda bangun. Boleh dikosongkan — Anda tetap bisa lanjut.</p>
            <Textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Contoh: Asisten yang membantu pemilik UMKM menyusun proposal pengajuan KUR ke bank."
              className="min-h-28"
              data-testid="input-intent"
            />
            <Button onClick={start} disabled={busy} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" data-testid="btn-start">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Mulai Merancang
            </Button>
          </div>
        )}

        {/* ── STEP: DIALOGUE ── */}
        {step === "dialogue" && dialogue && (
          <>
            {/* Progress card */}
            <div className="rounded-2xl border bg-white dark:bg-card p-5" data-testid="card-progress">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Progres Esensial</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400" data-testid="text-progress-count">
                  {dialogue.answeredEssential}/{dialogue.totalEssential}
                </span>
              </div>
              <Progress value={dPct} className="h-2" />
              {confidence && (
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <Gauge className="h-3.5 w-3.5 text-emerald-500" />
                  Keyakinan keseluruhan: <span className="font-bold text-gray-900 dark:text-white" data-testid="text-overall-confidence">{pct(confidence.overallConfidence)}%</span>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  Kelengkapan: {pct(confidence.overallCompletion)}%
                </div>
              )}
            </div>

            {/* Questions */}
            {dialogue.nextQuestions.length > 0 ? (
              <div className="rounded-2xl border bg-white dark:bg-card p-6 space-y-5" data-testid="card-questions">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    {dialogue.essentialComplete ? "Pertanyaan Lanjutan (opsional)" : "Pertanyaan Inti"}
                  </h2>
                </div>
                {dialogue.nextQuestions.map((q) => (
                  <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
                ))}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button onClick={submitAnswers} disabled={busy} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" data-testid="btn-submit-answers">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Simpan & Lanjut
                  </Button>
                  <Button onClick={runAnalyze} disabled={busy} variant="outline" className="gap-2" data-testid="btn-to-analyze">
                    <ClipboardList className="h-4 w-4" /> Selesai & Lihat Analisis
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30 p-6 text-center" data-testid="card-dialogue-done">
                <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Cukup untuk dianalisis</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Semua pertanyaan terpandu sudah terjawab. Lanjut ke analisis & konfigurasi.</p>
                <Button onClick={runAnalyze} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" data-testid="btn-to-analyze-2">
                  <ClipboardList className="h-4 w-4" /> Lihat Analisis
                </Button>
              </div>
            )}

            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1" data-testid="btn-reset">
              <RotateCcw className="h-3 w-3" /> Mulai ulang
            </button>
          </>
        )}

        {/* ── STEP: ANALYZE ── */}
        {step === "analyze" && analysis && (
          <div className="space-y-5" data-testid="step-analyze">
            {/* Scorecard */}
            <div className="grid sm:grid-cols-3 gap-3">
              <ScoreCard label="Keyakinan" value={`${pct(analysis.confidence.overallConfidence)}%`} sub={analysis.confidence.coreReady ? "Inti siap" : "Inti belum lengkap"} ok={analysis.confidence.coreReady} />
              <ScoreCard label="Mutu (Kritik)" value={`${pct(analysis.critique.overallScore)}%`} sub={`Grade ${analysis.critique.grade}`} ok={analysis.critique.overallScore >= 0.7} />
              <ScoreCard label="Simulasi" value={`${pct(analysis.simulation.coverage)}%`} sub={`${analysis.simulation.readyCount} skenario siap`} ok={analysis.simulation.coverage >= 0.7} />
            </div>

            {/* Gaps */}
            <div className="rounded-2xl border bg-white dark:bg-card p-5" data-testid="card-gaps">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className={`h-5 w-5 ${analysis.gaps.readyToApply ? "text-emerald-500" : "text-amber-500"}`} />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {analysis.gaps.readyToApply ? "Siap dikonfigurasi" : `${analysis.gaps.blockingCount} hal perlu dilengkapi`}
                </h3>
              </div>
              {analysis.gaps.nextActions.length > 0 ? (
                <ul className="space-y-1.5">
                  {analysis.gaps.nextActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400" data-testid={`gap-action-${i}`}>
                      <ArrowRight className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" /> {a}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-gray-500 dark:text-gray-400">Tidak ada rekomendasi tersisa.</p>}
            </div>

            {/* Critique summary */}
            <div className="rounded-2xl border bg-white dark:bg-card p-5" data-testid="card-critique">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Catatan Kritik</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{analysis.critique.summary}</p>
              {analysis.critique.findings.slice(0, 4).map((f, i) => (
                <div key={i} className="border-t border-gray-100 dark:border-gray-800 pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{f.dimension}</Badge>
                    <span className="text-xs text-gray-700 dark:text-gray-300">{f.message}</span>
                  </div>
                  {f.recommendation && <p className="text-[11px] text-gray-400 mt-1 pl-1">→ {f.recommendation}</p>}
                </div>
              ))}
            </div>

            {/* Configure preview / create */}
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/20 p-5" data-testid="card-configure">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Buat Agen dari Blueprint</h3>
              </div>
              {!preview ? (
                <>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Lihat pratinjau dulu (tanpa menyimpan apa pun) sebelum benar-benar membuat agen.</p>
                  <Button onClick={previewConfigure} disabled={busy} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" data-testid="btn-preview-configure">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Info className="h-4 w-4" />} Pratinjau Konfigurasi
                  </Button>
                </>
              ) : (
                <>
                  <div className="rounded-xl bg-white dark:bg-card border p-4 mb-3 text-xs space-y-1.5" data-testid="preview-result">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold"><Check className="h-3.5 w-3.5" /> Pratinjau berhasil (belum disimpan)</div>
                    <p className="text-gray-600 dark:text-gray-400">Field agen yang akan diisi: <span className="font-semibold text-gray-900 dark:text-white">{preview.agentPatchKeys.length}</span></p>
                    <p className="text-gray-600 dark:text-gray-400">Akan dibuat: {preview.created.knowledgeBases} basis pengetahuan · {preview.created.miniApps} mini app · {preview.created.integrations} integrasi</p>
                    {preview.warnings.length > 0 && (
                      <div className="text-amber-600 dark:text-amber-400 pt-1">⚠ {preview.warnings.slice(0, 3).join(" · ")}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={confirmCreate} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" data-testid="btn-confirm-create">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Buat Agen Sekarang
                    </Button>
                    <Button onClick={() => setPreview(null)} variant="outline" disabled={busy} data-testid="btn-cancel-preview">Batal</Button>
                  </div>
                </>
              )}
            </div>

            <Button onClick={() => setStep("dialogue")} variant="ghost" className="gap-2 text-gray-500" data-testid="btn-back-dialogue">
              <ArrowLeft className="h-4 w-4" /> Kembali ke pertanyaan
            </Button>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === "done" && created && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-8 text-center" data-testid="step-done">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4">
              <Check className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Agen Berhasil Dibuat 🎉</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{created.agentPatchKeys.length} field dikonfigurasi otomatis dari Blueprint Anda.</p>
            {(created.created.knowledgeBases + created.created.miniApps + created.created.integrations) > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{created.created.knowledgeBases} basis pengetahuan · {created.created.miniApps} mini app · {created.created.integrations} integrasi dibuat.</p>
            )}
            {created.warnings.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">⚠ {created.warnings.slice(0, 3).join(" · ")}</p>
            )}
            <div className="flex flex-wrap gap-3 justify-center mt-4">
              {created.agentId && (
                <Button onClick={openInBuilder} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" data-testid="btn-open-in-builder">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Buka di Builder
                </Button>
              )}
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2" data-testid="btn-to-dashboard">
                  Buka Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button onClick={reset} variant="outline" className="gap-2" data-testid="btn-build-another">
                <RotateCcw className="h-4 w-4" /> Rancang Agen Lain
              </Button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">"Buka di Builder" mengaktifkan agen ini & membawa Anda ke editor — field sudah terisi otomatis dari Blueprint.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────────── */
function ScoreCard({ label, value, sub, ok }: { label: string; value: string; sub: string; ok: boolean }) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-card p-4 text-center" data-testid={`scorecard-${label}`}>
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</div>
      <div className={`text-[11px] font-medium mt-1 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{sub}</div>
    </div>
  );
}

function QuestionField({ q, value, onChange }: { q: DialogueQuestion; value: any; onChange: (v: any) => void }) {
  return (
    <div className="space-y-1.5" data-testid={`field-${q.id}`}>
      <Label className="text-sm font-medium text-gray-900 dark:text-white">{q.question}</Label>
      {q.why && <p className="text-[11px] text-gray-400">{q.why}</p>}

      {q.inputType === "textarea" && (
        <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="min-h-20" data-testid={`q-input-${q.id}`} />
      )}
      {q.inputType === "text" && (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} data-testid={`q-input-${q.id}`} />
      )}
      {q.inputType === "number" && (
        <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} data-testid={`q-input-${q.id}`} />
      )}
      {q.inputType === "list" && (
        <Textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Pisahkan dengan koma atau baris baru"
          className="min-h-16"
          data-testid={`q-input-${q.id}`}
        />
      )}
      {q.inputType === "boolean" && (
        <div className="flex items-center gap-2 pt-1">
          <Switch checked={value === true} onCheckedChange={(c) => onChange(c)} data-testid={`q-switch-${q.id}`} />
          <span className="text-xs text-gray-500 dark:text-gray-400">{value === true ? "Ya" : "Tidak"}</span>
        </div>
      )}
      {q.inputType === "select" && q.options && (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger data-testid={`q-select-${q.id}`}><SelectValue placeholder="Pilih..." /></SelectTrigger>
          <SelectContent>
            {q.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {q.inputType === "multiselect" && q.options && (
        <div className="flex flex-wrap gap-2 pt-1" data-testid={`q-multiselect-${q.id}`}>
          {q.options.map((o) => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const active = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(active ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white dark:bg-card border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400"}`}
                data-testid={`q-option-${q.id}-${o.value}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
