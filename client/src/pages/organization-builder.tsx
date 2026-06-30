import { useState } from "react";
import { Link } from "wouter";
import { SharedHeader } from "@/components/shared-header";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Sparkles, ArrowRight, ArrowLeft, Loader2, Lock, Check, AlertTriangle,
  Plus, Trash2, Crown, Rocket, RotateCcw, Info, Network, ClipboardList, Wand2,
} from "lucide-react";
import {
  createEmptyOrganizationBlueprint,
  type OrganizationBlueprint,
  type OrgMemberRole,
} from "@shared/blueprint/organization-blueprint-schema";
import { createEmptyBlueprint } from "@shared/blueprint/blueprint-schema";

/* ── Types (mirror server/organization-engine-routes.ts responses) ─────────── */
interface LintWarning { scope: "members" | "structure"; ref?: string; message: string }
interface AnalyzeResponse {
  lint: LintWarning[];
  plan: {
    memberCount: number;
    orchestratorCount: number;
    wiring: { orchestratorLocalId: string; subAgentCount: number }[];
    warnings: string[];
  };
}
interface ConfigureMember {
  localId: string; role: OrgMemberRole; title?: string; agentId?: string;
  agentPatchKeys: string[]; agentPatchPreview: Record<string, string>;
}
interface SuggestMember {
  localId: string; role: OrgMemberRole; title: string; responsibility: string;
}
interface SuggestResponse { domain: string; members: SuggestMember[] }
interface InferMember {
  localId: string; role: OrgMemberRole; title: string; responsibility: string; systemPrompt: string;
}
interface InferResponse {
  overallConfidence: number;
  edgesAdded: number;
  memberInferences: { localId: string; written: number }[];
  warnings: string[];
  members: InferMember[];
}
interface ConfigureResult {
  applied: boolean;
  dryRun: boolean;
  atomic: boolean;
  organizationName?: string;
  members: ConfigureMember[];
  idMap: Record<string, string>;
  wiring: { orchestratorLocalId: string; orchestratorAgentId?: string; subAgentCount: number }[];
  created: { agents: number; knowledgeBases: number; miniApps: number; integrations: number; projectBrainTemplates: number };
  warnings: string[];
}

/* ── UI member draft (sebelum jadi OrganizationBlueprint) ──────────────────── */
interface MemberDraft {
  localId: string;
  role: OrgMemberRole;
  title: string;
  responsibility: string;
  systemPrompt: string; // opsional (lanjutan); kosong → di-generate otomatis
}

type Step = "intro" | "members" | "review" | "done";

const ROLE_LABEL: Record<OrgMemberRole, string> = {
  orchestrator: "Ketua Tim",
  specialist: "Spesialis",
  support: "Pendukung",
};
const ROLE_HINT: Record<OrgMemberRole, string> = {
  orchestrator: "Mengoordinasi & menggabungkan jawaban anggota lain",
  specialist: "Fokus mendalam pada satu bidang",
  support: "Membantu intake, FAQ, atau administrasi",
};

/* Ubah judul jadi kode peran agenticSubAgents (mis. "Agen Pajak" → "AGEN_PAJAK"). */
function roleCode(title: string, idx: number): string {
  const slug = (title || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase()
    .slice(0, 32);
  return slug || `ANGGOTA_${idx + 1}`;
}

/* Prompt sistem default bila pengguna tak mengisi (agar agen punya "otak"). */
function defaultPrompt(m: MemberDraft, orgName: string, mission: string): string {
  const team = orgName.trim() ? ` dalam tim "${orgName.trim()}"` : "";
  const aim = mission.trim() ? ` Tim ini bertujuan: ${mission.trim()}.` : "";
  const task = m.responsibility.trim()
    ? ` Tugas utamamu: ${m.responsibility.trim()}.`
    : "";
  const lead = m.role === "orchestrator"
    ? " Sebagai ketua tim, pahami kebutuhan pengguna, bagikan pekerjaan ke anggota yang tepat, lalu rangkum jawaban akhir yang jelas."
    : "";
  return `Kamu adalah ${m.title.trim() || "agen AI"}${team}.${aim}${task}${lead} Jawablah dengan akurat, jelas, dan sopan dalam Bahasa Indonesia.`;
}

const pct = (n: number) => Math.round((n || 0) * 100);

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function OrganizationBuilderPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("intro");
  const [orgName, setOrgName] = useState("");
  const [mission, setMission] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([
    { localId: "m1", role: "orchestrator", title: "", responsibility: "", systemPrompt: "" },
  ]);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [preview, setPreview] = useState<ConfigureResult | null>(null);
  const [created, setCreated] = useState<ConfigureResult | null>(null);
  const [createError, setCreateError] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [maxSpecialists, setMaxSpecialists] = useState(3);
  const [composedDomain, setComposedDomain] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<number | null>(null);

  /* ── Member helpers ── */
  const addMember = (role: OrgMemberRole) => {
    setMembers((ms) => {
      const maxN = ms.reduce((mx, m) => {
        const n = parseInt(m.localId.replace(/\D/g, ""), 10);
        return Number.isFinite(n) ? Math.max(mx, n) : mx;
      }, 0);
      return [...ms, { localId: `m${maxN + 1}`, role, title: "", responsibility: "", systemPrompt: "" }];
    });
  };
  const removeMember = (localId: string) =>
    setMembers((ms) => ms.filter((m) => m.localId !== localId));
  const patchMember = (localId: string, patch: Partial<MemberDraft>) =>
    setMembers((ms) => ms.map((m) => (m.localId === localId ? { ...m, ...patch } : m)));

  /* ── Bangun OrganizationBlueprint dari draft (client-side, valid by schema) ──
   * fillDefaults=false → JANGAN isi systemPrompt default (biar inferensi tahu
   * field mana yang masih kosong; dipakai oleh "Sempurnakan Detail"). */
  const buildOrg = (fillDefaults = true): OrganizationBlueprint => {
    const org = createEmptyOrganizationBlueprint(mission.trim() || undefined);
    org.meta.name = orgName.trim() || undefined;
    org.meta.mission = mission.trim() || undefined;

    org.members = members.map((m) => {
      const bp = createEmptyBlueprint(m.responsibility.trim() || m.title.trim() || undefined);
      bp.meta.intent = m.responsibility.trim() || m.title.trim() || undefined;
      (bp.modules.identity.data as any).name = m.title.trim() || `Anggota ${m.localId}`;
      if (m.responsibility.trim()) (bp.modules.identity.data as any).description = m.responsibility.trim();
      (bp.modules.aiEngine.data as any).systemPrompt = fillDefaults
        ? (m.systemPrompt.trim() || defaultPrompt(m, orgName, mission))
        : m.systemPrompt.trim();
      return {
        localId: m.localId,
        role: m.role,
        title: m.title.trim() || undefined,
        responsibility: m.responsibility.trim() || undefined,
        blueprint: bp,
      };
    });

    const lead = members.find((m) => m.role === "orchestrator");
    const edges = lead
      ? members
          .filter((m) => m.localId !== lead.localId)
          .map((m, i) => ({
            fromLocalId: lead.localId,
            toLocalId: m.localId,
            role: roleCode(m.title, i),
            description: m.responsibility.trim() || m.title.trim() || undefined,
          }))
      : [];
    org.structure = { leadLocalId: lead?.localId, edges };
    return org;
  };

  /* ── Validasi sebelum lanjut ── */
  const membersReady = members.every((m) => m.title.trim().length > 0);
  const orchestratorCount = members.filter((m) => m.role === "orchestrator").length;
  // Tim valid = tepat satu Ketua Tim + minimal satu anggota lain.
  const topologyValid = orchestratorCount === 1 && members.length >= 2;
  const topologyHint = !membersReady
    ? "Isi nama setiap anggota dulu."
    : orchestratorCount === 0
      ? "Tetapkan tepat satu anggota sebagai Ketua Tim."
      : orchestratorCount > 1
        ? "Hanya boleh ada satu Ketua Tim."
        : members.length < 2
          ? "Tambah minimal satu anggota lain (Spesialis/Pendukung)."
          : "";

  /* ── API ── */
  /* Susun otomatis dari misi (Tahap 23 engine via /api/organization/suggest). */
  const composeFromMission = async () => {
    if (!mission.trim()) {
      toast({ title: "Isi misi tim dulu", description: "Tuliskan misi/tujuan tim agar bisa disusun otomatis.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const data: SuggestResponse = await apiRequest("POST", "/api/organization/suggest", { mission: mission.trim(), maxSpecialists });
      const suggested: MemberDraft[] = (data.members || []).map((m) => ({
        localId: m.localId,
        role: m.role,
        title: m.title || "",
        responsibility: m.responsibility || "",
        systemPrompt: "",
      }));
      if (suggested.length === 0) {
        toast({ title: "Belum ada usulan", description: "Coba tuliskan misi lebih spesifik.", variant: "destructive" });
        return;
      }
      setMembers(suggested);
      setComposedDomain(data.domain || null);
      setAnalysis(null); setPreview(null); setCreated(null); setCreateError(null);
      setStep("members");
      toast({ title: `Tim disusun otomatis (${data.domain})`, description: `${suggested.length} anggota diusulkan. Tinjau & sesuaikan sebelum dibuat.` });
    } catch (e: any) {
      toast({ title: "Gagal menyusun otomatis", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  /* Sempurnakan Detail: isi otomatis tugas + prompt anggota yang masih kosong
   * (Tahap 23 inferOrganization via /api/organization/infer). Input pengguna
   * tak pernah ditimpa — hanya field kosong yang diisi. */
  const enrichMembers = async () => {
    if (!membersReady) {
      toast({ title: "Isi nama anggota dulu", description: "Setiap anggota perlu nama agar bisa dilengkapi otomatis.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const data: InferResponse = await apiRequest("POST", "/api/organization/infer", { organization: buildOrg(false) });
      const byId = new Map(data.members.map((m) => [m.localId, m]));
      let filled = 0;
      setMembers((ms) => ms.map((m) => {
        const inf = byId.get(m.localId);
        if (!inf) return m;
        const next = { ...m };
        if (!m.responsibility.trim() && inf.responsibility.trim()) { next.responsibility = inf.responsibility.trim(); filled++; }
        if (!m.systemPrompt.trim() && inf.systemPrompt.trim()) { next.systemPrompt = inf.systemPrompt.trim(); filled++; }
        return next;
      }));
      setReadiness(data.overallConfidence);
      toast({
        title: `Kesiapan tim ${pct(data.overallConfidence)}%`,
        description: filled > 0 ? `${filled} bagian dilengkapi otomatis. Tinjau & sesuaikan bila perlu.` : "Detail tim sudah lengkap.",
      });
    } catch (e: any) {
      toast({ title: "Gagal melengkapi", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  /* Regenerasi anggota tunggal: tulis ulang instruksi (systemPrompt) SATU anggota
   * dari nama + tugasnya, via /infer. Mengosongkan systemPrompt anggota target di
   * payload agar inferensi membuatkan yang baru, lalu menimpa HANYA anggota itu. */
  const regenerateMember = async (localId: string) => {
    const target = members.find((m) => m.localId === localId);
    if (!target || !target.title.trim()) {
      toast({ title: "Isi nama agen dulu", description: "Nama agen diperlukan untuk membuat instruksinya.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const org = buildOrg(false);
      const om = org.members.find((m) => m.localId === localId);
      if (om) (om.blueprint.modules.aiEngine.data as any).systemPrompt = "";
      const data: InferResponse = await apiRequest("POST", "/api/organization/infer", { organization: org });
      const inf = data.members.find((m) => m.localId === localId);
      if (inf?.systemPrompt?.trim()) {
        patchMember(localId, { systemPrompt: inf.systemPrompt.trim() });
        toast({ title: "Instruksi dibuat ulang", description: `Instruksi untuk "${target.title.trim()}" diperbarui. Tinjau & sesuaikan bila perlu.` });
      } else {
        toast({ title: "Belum bisa dibuat", description: "Tambahkan tugas anggota agar instruksinya lebih lengkap.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Gagal membuat instruksi", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const runAnalyze = async () => {
    setBusy(true);
    try {
      const data = await apiRequest("POST", "/api/organization/analyze", { organization: buildOrg() });
      setAnalysis(data);
      setPreview(null);
      setStep("review");
    } catch (e: any) {
      toast({ title: "Gagal menganalisis", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const previewConfigure = async () => {
    setBusy(true);
    setCreateError(null);
    try {
      const data = await apiRequest("POST", "/api/organization/configure", { organization: buildOrg(), dryRun: true });
      setPreview(data);
    } catch (e: any) {
      toast({ title: "Gagal pratinjau", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const confirmCreate = async () => {
    if (!topologyValid) {
      setCreateError([topologyHint || "Struktur tim belum valid."]);
      return;
    }
    setBusy(true);
    try {
      const data = await apiRequest("POST", "/api/organization/configure", { organization: buildOrg(), dryRun: false });
      if (!data.applied) {
        setCreateError(data.warnings?.length ? data.warnings : ["Tim belum dibuat. Periksa kembali konfigurasi anggota lalu coba lagi."]);
        toast({
          title: "Tim belum dibuat",
          description: (data.warnings?.[0] as string) || "Periksa kembali konfigurasi anggota.",
          variant: "destructive",
        });
        return;
      }
      setCreateError(null);
      setCreated(data);
      setStep("done");
    } catch (e: any) {
      toast({ title: "Gagal membuat tim", description: e?.message || "Coba lagi.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const reset = () => {
    setStep("intro"); setOrgName(""); setMission("");
    setMembers([{ localId: "m1", role: "orchestrator", title: "", responsibility: "", systemPrompt: "" }]);
    setAnalysis(null); setPreview(null); setCreated(null); setCreateError(null);
    setComposedDomain(null); setMaxSpecialists(3); setReadiness(null);
  };

  /* ── Auth gate ── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-background">
        <SharedHeader />
        <div className="flex items-center justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white dark:bg-background">
        <SharedHeader />
        <div className="max-w-md mx-auto text-center py-24 px-4" data-testid="gate-login">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mx-auto mb-5">
            <Lock className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Masuk untuk Merakit Tim AI</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Pembuat Tim membuat beberapa agen yang saling bekerja sama di akun Anda, jadi perlu login dulu.</p>
          <Link href="/login">
            <Button className="bg-violet-600 hover:bg-violet-500 text-white gap-2" data-testid="btn-login">
              Masuk <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background" data-testid="page-organization-builder">
      <SharedHeader />

      {/* Hero strip */}
      <div className="bg-gradient-to-br from-violet-700 via-fuchsia-700 to-purple-700 px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold mb-3">
            <Users className="h-3.5 w-3.5" /> Pembuat Tim AI
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Rakit Satu Tim Agen yang Saling Bekerja Sama</h1>
          <p className="text-sm text-violet-100">Tentukan misi tim, tambah anggota beserta tugasnya, lalu buat semuanya sekaligus — ketua tim otomatis terhubung ke setiap anggota.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── STEP: INTRO ── */}
        {step === "intro" && (
          <div className="rounded-2xl border bg-white dark:bg-card p-6 space-y-4" data-testid="step-intro">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Mulai dari Misi Tim</h2>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-900 dark:text-white">Nama Tim</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Contoh: Tim Konsultan Konstruksi" data-testid="input-org-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-900 dark:text-white">Misi / Tujuan Tim</Label>
              <Textarea value={mission} onChange={(e) => setMission(e.target.value)} placeholder="Contoh: Membantu pemilik UMKM konstruksi mengurus perizinan, tender, dan kepatuhan K3." className="min-h-24" data-testid="input-mission" />
            </div>
            <div className="rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-950/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wand2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <span className="text-sm font-bold text-gray-900 dark:text-white">Susun otomatis dari misi</span>
                <Badge variant="outline" className="text-[10px]">Baru</Badge>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Biarkan sistem mengusulkan susunan anggota (Ketua Tim + Spesialis) dari misi Anda. Anda tetap bisa meninjau & menyesuaikan sebelum tim dibuat.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Jumlah Spesialis</Label>
                  <Select value={String(maxSpecialists)} onValueChange={(v) => setMaxSpecialists(Number(v))}>
                    <SelectTrigger className="w-28" data-testid="select-max-specialists"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} spesialis</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={composeFromMission}
                  disabled={busy || !mission.trim()}
                  className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
                  data-testid="btn-compose-auto"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Susun Otomatis
                </Button>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Tim selalu punya 1 Ketua Tim. Jumlah spesialis nyata bisa lebih sedikit jika bidangnya terbatas.</p>
              {!mission.trim() && (
                <span className="text-xs text-amber-600 dark:text-amber-400 ml-3" data-testid="hint-compose-needs-mission">
                  Isi misi tim dulu untuk memakai fitur ini.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-[11px] text-gray-400 uppercase tracking-wide">atau susun manual</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            <Button
              onClick={() => { setComposedDomain(null); setStep("members"); }}
              disabled={!orgName.trim()}
              variant="outline"
              className="gap-2"
              data-testid="btn-to-members"
            >
              Susun Anggota Sendiri <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── STEP: MEMBERS ── */}
        {step === "members" && (
          <div className="space-y-5" data-testid="step-members">
            <div className="rounded-2xl border bg-white dark:bg-card p-5" data-testid="card-members-intro">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Anggota Tim</h2>
                {composedDomain && (
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 gap-1 text-[10px]" data-testid="badge-composed-domain">
                    <Wand2 className="h-3 w-3" /> Disusun otomatis · bidang {composedDomain}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {composedDomain
                  ? "Ini usulan otomatis. Tinjau, ubah nama/tugas, tambah atau hapus anggota sesuai kebutuhan sebelum membuat tim."
                  : <>Tetapkan <span className="font-semibold">satu Ketua Tim</span> yang mengoordinasi, lalu tambah Spesialis/Pendukung. Ketua otomatis terhubung ke setiap anggota lain.</>}
              </p>
              {orchestratorCount !== 1 && (
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400" data-testid="warn-orchestrator-count">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {orchestratorCount === 0
                    ? "Belum ada Ketua Tim. Tetapkan satu anggota sebagai Ketua Tim agar anggota lain terhubung."
                    : "Disarankan hanya satu Ketua Tim. Yang pertama akan dipakai untuk menghubungkan anggota."}
                </div>
              )}
            </div>

            {members.map((m, idx) => (
              <div key={m.localId} className="rounded-2xl border bg-white dark:bg-card p-5 space-y-4" data-testid={`card-member-${m.localId}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {m.role === "orchestrator"
                      ? <Crown className="h-4 w-4 text-amber-500" />
                      : <Users className="h-4 w-4 text-violet-500" />}
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Anggota {idx + 1}</span>
                    <Badge variant="outline" className="text-[10px]">{ROLE_LABEL[m.role]}</Badge>
                  </div>
                  {members.length > 1 && (
                    <button onClick={() => removeMember(m.localId)} className="text-gray-400 hover:text-red-500 transition-colors" data-testid={`btn-remove-${m.localId}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Nama / Peran Agen</Label>
                    <Input value={m.title} onChange={(e) => patchMember(m.localId, { title: e.target.value })} placeholder="Contoh: Agen Perizinan" data-testid={`input-title-${m.localId}`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Posisi di Tim</Label>
                    <Select value={m.role} onValueChange={(v) => patchMember(m.localId, { role: v as OrgMemberRole })}>
                      <SelectTrigger data-testid={`select-role-${m.localId}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="orchestrator">{ROLE_LABEL.orchestrator}</SelectItem>
                        <SelectItem value="specialist">{ROLE_LABEL.specialist}</SelectItem>
                        <SelectItem value="support">{ROLE_LABEL.support}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-gray-400">{ROLE_HINT[m.role]}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Tugas Anggota Ini</Label>
                  <Textarea value={m.responsibility} onChange={(e) => patchMember(m.localId, { responsibility: e.target.value })} placeholder="Contoh: Membantu mengurus NIB, SBU, dan izin usaha lewat OSS." className="min-h-16" data-testid={`input-responsibility-${m.localId}`} />
                </div>

                <details className="group">
                  <summary className="text-xs text-violet-600 dark:text-violet-400 cursor-pointer select-none">Instruksi sistem (lanjutan, opsional)</summary>
                  <Textarea
                    value={m.systemPrompt}
                    onChange={(e) => patchMember(m.localId, { systemPrompt: e.target.value })}
                    placeholder="Kosongkan untuk dibuat otomatis dari nama, tugas, dan misi tim."
                    className="min-h-20 mt-2"
                    data-testid={`input-prompt-${m.localId}`}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => regenerateMember(m.localId)}
                      disabled={busy || !m.title.trim()}
                      className="gap-1.5 h-7 text-[11px] border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                      data-testid={`btn-regenerate-${m.localId}`}
                    >
                      <Wand2 className="h-3 w-3" /> {m.systemPrompt.trim() ? "Tulis ulang otomatis" : "Buatkan otomatis"}
                    </Button>
                    {!m.title.trim() && (
                      <span className="text-[11px] text-gray-400">Isi nama agen dulu.</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Hanya menulis ulang instruksi anggota ini, dari nama & tugasnya. Anggota lain tidak terpengaruh.</p>
                </details>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => addMember("specialist")} variant="outline" className="gap-2" data-testid="btn-add-specialist">
                <Plus className="h-4 w-4" /> Tambah Spesialis
              </Button>
              <Button onClick={() => addMember("support")} variant="outline" className="gap-2" data-testid="btn-add-support">
                <Plus className="h-4 w-4" /> Tambah Pendukung
              </Button>
              <Button
                onClick={enrichMembers}
                disabled={busy || !membersReady}
                variant="outline"
                className="gap-2 border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                data-testid="btn-enrich-members"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Sempurnakan Detail
              </Button>
              {readiness !== null && (
                <span className="self-center text-xs font-medium text-violet-700 dark:text-violet-300" data-testid="text-readiness">
                  Kesiapan setelah penyempurnaan: {pct(readiness)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 -mt-2">
              "Sempurnakan Detail" mengisi tugas & instruksi anggota yang masih kosong secara otomatis. Isian Anda tidak akan ditimpa.
            </p>

            <div className="flex flex-wrap gap-3 pt-2 border-t">
              <Button onClick={() => setStep("intro")} variant="ghost" className="gap-2 text-gray-500" data-testid="btn-back-intro">
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
              <Button
                onClick={runAnalyze}
                disabled={busy || !membersReady || !topologyValid}
                className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
                data-testid="btn-to-review"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />} Periksa & Tinjau
              </Button>
              {(!membersReady || !topologyValid) && (
                <span className="text-xs text-amber-600 dark:text-amber-400 self-center" data-testid="hint-cannot-review">{topologyHint}</span>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: REVIEW ── */}
        {step === "review" && analysis && (
          <div className="space-y-5" data-testid="step-review">
            {/* Plan summary */}
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border bg-white dark:bg-card p-4 text-center" data-testid="stat-members">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Anggota</div>
                <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{analysis.plan.memberCount}</div>
              </div>
              <div className="rounded-2xl border bg-white dark:bg-card p-4 text-center" data-testid="stat-orchestrators">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Ketua Tim</div>
                <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{analysis.plan.orchestratorCount}</div>
              </div>
              <div className="rounded-2xl border bg-white dark:bg-card p-4 text-center" data-testid="stat-links">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Koneksi</div>
                <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                  {analysis.plan.wiring.reduce((s, w) => s + w.subAgentCount, 0)}
                </div>
              </div>
            </div>

            {/* Lint */}
            <div className="rounded-2xl border bg-white dark:bg-card p-5" data-testid="card-lint">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className={`h-5 w-5 ${analysis.lint.length === 0 ? "text-emerald-500" : "text-amber-500"}`} />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {analysis.lint.length === 0 ? "Struktur tim rapi" : `${analysis.lint.length} catatan struktur`}
                </h3>
              </div>
              {analysis.lint.length > 0 ? (
                <ul className="space-y-1.5">
                  {analysis.lint.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400" data-testid={`lint-${i}`}>
                      <ArrowRight className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span><span className="font-medium">{w.ref ? `${w.ref}: ` : ""}</span>{w.message}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-gray-500 dark:text-gray-400">Semua anggota & koneksi konsisten. Siap dibuat.</p>}
            </div>

            {/* Wiring detail */}
            {analysis.plan.wiring.length > 0 && (
              <div className="rounded-2xl border bg-white dark:bg-card p-5" data-testid="card-wiring">
                <div className="flex items-center gap-2 mb-3">
                  <Network className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Peta Kerja Sama</h3>
                </div>
                {analysis.plan.wiring.map((w) => {
                  const lead = members.find((m) => m.localId === w.orchestratorLocalId);
                  return (
                    <p key={w.orchestratorLocalId} className="text-xs text-gray-600 dark:text-gray-400" data-testid={`wiring-${w.orchestratorLocalId}`}>
                      <Crown className="h-3.5 w-3.5 text-amber-500 inline mr-1" />
                      <span className="font-semibold text-gray-900 dark:text-white">{lead?.title || w.orchestratorLocalId}</span> mengoordinasi <span className="font-semibold">{w.subAgentCount}</span> anggota.
                    </p>
                  );
                })}
              </div>
            )}

            {/* Configure preview / create */}
            <div className="rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-950/20 p-5" data-testid="card-configure">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Buat Tim dari Rancangan</h3>
              </div>
              {!preview ? (
                <>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Lihat pratinjau dulu (tanpa menyimpan apa pun) sebelum benar-benar membuat tim.</p>
                  <Button onClick={previewConfigure} disabled={busy} className="bg-violet-600 hover:bg-violet-500 text-white gap-2" data-testid="btn-preview-configure">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Info className="h-4 w-4" />} Pratinjau Tim
                  </Button>
                </>
              ) : (
                <>
                  <div className="rounded-xl bg-white dark:bg-card border p-4 mb-3 text-xs space-y-2" data-testid="preview-result">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold"><Check className="h-3.5 w-3.5" /> Pratinjau berhasil (belum disimpan)</div>
                    <p className="text-gray-600 dark:text-gray-400">Akan dibuat <span className="font-semibold text-gray-900 dark:text-white">{preview.members.length} agen</span> yang saling terhubung.</p>
                    <ul className="border-t pt-2 space-y-1">
                      {preview.members.map((mm) => (
                        <li key={mm.localId} className="flex items-center gap-2" data-testid={`preview-member-${mm.localId}`}>
                          {mm.role === "orchestrator"
                            ? <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                            : <Users className="h-3 w-3 text-violet-500 shrink-0" />}
                          <span className="font-medium text-gray-900 dark:text-white">{mm.title || mm.localId}</span>
                          <Badge variant="outline" className="text-[10px]">{ROLE_LABEL[mm.role]}</Badge>
                          <span className="text-gray-400">{mm.agentPatchKeys.length} field</span>
                        </li>
                      ))}
                    </ul>
                    {preview.warnings.length > 0 && (
                      <div className="text-amber-600 dark:text-amber-400 border-t pt-2">⚠ {preview.warnings.slice(0, 3).join(" · ")}</div>
                    )}
                  </div>
                  {createError && (
                    <div className="rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/20 p-3 mb-3 text-xs" data-testid="create-error">
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Tim belum bisa dibuat
                      </div>
                      <ul className="space-y-1 text-red-600 dark:text-red-400">
                        {createError.slice(0, 4).map((w, i) => <li key={i}>• {w}</li>)}
                      </ul>
                      <p className="text-gray-500 dark:text-gray-400 mt-1.5">Kembali ke anggota untuk memperbaiki, lalu pratinjau & buat ulang.</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={confirmCreate} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" data-testid="btn-confirm-create">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Buat Tim Sekarang
                    </Button>
                    <Button onClick={() => { setPreview(null); setCreateError(null); }} variant="outline" disabled={busy} data-testid="btn-cancel-preview">Batal</Button>
                  </div>
                </>
              )}
            </div>

            <Button onClick={() => setStep("members")} variant="ghost" className="gap-2 text-gray-500" data-testid="btn-back-members">
              <ArrowLeft className="h-4 w-4" /> Kembali ke anggota
            </Button>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === "done" && created && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-8 text-center" data-testid="step-done">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4">
              <Check className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Tim AI Berhasil Dibuat 🎉</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {created.created.agents} agen dibuat & saling terhubung{created.organizationName ? ` untuk "${created.organizationName}"` : ""}.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Semua agen kini ada di Dashboard Anda dan bisa diatur lebih lanjut.</p>
            {created.warnings.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">⚠ {created.warnings.slice(0, 3).join(" · ")}</p>
            )}
            <div className="flex flex-wrap gap-3 justify-center mt-4">
              <Link href="/dashboard">
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" data-testid="btn-to-dashboard">
                  Buka Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button onClick={reset} variant="outline" className="gap-2" data-testid="btn-build-another">
                <RotateCcw className="h-4 w-4" /> Rakit Tim Lain
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
