import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Briefcase, ChevronRight, Loader2, FolderOpen,
} from "lucide-react";
import type { Workroom } from "@shared/schema";

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  done: "Selesai",
  archived: "Arsip",
};

export default function WorkroomListPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [instansi, setInstansi] = useState("");
  const [nilai, setNilai] = useState("");
  const [catatan, setCatatan] = useState("");

  const { data: rooms, isLoading } = useQuery<Workroom[]>({
    queryKey: ["/api/workrooms"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/workrooms", {
        title,
        domain: "tender",
        context: { instansi, nilai, catatan },
      });
    },
    onSuccess: (room: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workrooms"] });
      toast({ title: "Workroom dibuat", description: "Ruang kerja tender siap digunakan." });
      setShowForm(false);
      setTitle(""); setInstansi(""); setNilai(""); setCatatan("");
      if (room?.id) navigate(`/workroom/${room.id}`);
    },
    onError: (e: any) => {
      toast({ title: "Gagal", description: e?.message || "Tidak bisa membuat workroom", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="text-slate-300">
            <Link href="/os" data-testid="button-back-os">
              <ArrowLeft className="h-4 w-4 mr-2" /> Gustafta OS
            </Link>
          </Button>
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            <Briefcase className="h-3.5 w-3.5 mr-1" /> Workroom
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Workroom Tender</h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Ruang kerja manusia + agen untuk menggarap tender bertahap: dari identifikasi peluang,
              analisis kelayakan, sampai gerbang persetujuan ◆ sebelum submit.
            </p>
          </div>
          <Button
            onClick={() => setShowForm((v) => !v)}
            className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
            data-testid="button-new-workroom"
          >
            <Plus className="h-4 w-4 mr-2" /> Workroom Baru
          </Button>
        </div>

        {showForm && (
          <Card className="bg-slate-900 border-slate-800 mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Buat Workroom Tender Baru</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Judul / Nama Paket Tender *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="mis. Pembangunan Gedung Kantor Dinas PU"
                  className="bg-slate-950 border-slate-700"
                  data-testid="input-title"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Instansi / Pemberi Kerja</label>
                  <Input
                    value={instansi}
                    onChange={(e) => setInstansi(e.target.value)}
                    placeholder="mis. Dinas PUPR Kab. X"
                    className="bg-slate-950 border-slate-700"
                    data-testid="input-instansi"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Nilai Pagu / HPS</label>
                  <Input
                    value={nilai}
                    onChange={(e) => setNilai(e.target.value)}
                    placeholder="mis. Rp 4,5 Miliar"
                    className="bg-slate-950 border-slate-700"
                    data-testid="input-nilai"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Catatan Awal</label>
                <Textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Ringkas syarat, kualifikasi SBU/SKK, deadline, atau catatan lain."
                  className="bg-slate-950 border-slate-700 min-h-[80px]"
                  data-testid="input-catatan"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowForm(false)} data-testid="button-cancel">
                  Batal
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || title.trim().length < 3}
                  className="bg-emerald-600 hover:bg-emerald-500"
                  data-testid="button-create-workroom"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Buat & Buka
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat workroom…
          </div>
        ) : !rooms || rooms.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
            <FolderOpen className="h-10 w-10 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">Belum ada workroom. Buat yang pertama untuk mulai menggarap tender.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {rooms.map((room) => {
              const stages = (room.stages as any[]) || [];
              const done = stages.filter((s) => s.status === "done").length;
              return (
                <Link key={room.id} href={`/workroom/${room.id}`} data-testid={`card-workroom-${room.id}`}>
                  <Card className="bg-slate-900 border-slate-800 hover:border-emerald-500/40 transition-colors cursor-pointer">
                    <CardContent className="p-5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate" data-testid={`text-workroom-title-${room.id}`}>{room.title}</h3>
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                            {STATUS_LABEL[room.status] || room.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500">
                          Tahap {Math.min(done + 1, stages.length)} dari {stages.length} · {done} selesai
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-600 shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
