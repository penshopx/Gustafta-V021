import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SharedHeader } from "@/components/shared-header";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ticket, Lock, ArrowRight, Loader2, Plus, Copy } from "lucide-react";

type AccessCode = {
  id: number; code: string; plan: string; durationDays: number; label: string | null;
  maxRedemptions: number; redemptionCount: number; active: boolean; createdAt: string;
};

const PLANS = ["starter", "profesional", "bisnis", "enterprise"];

export default function AdminAccessCodesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [plan, setPlan] = useState("profesional");
  const [durationDays, setDurationDays] = useState("30");
  const [label, setLabel] = useState("Indobuildtech 2026");
  const [maxRedemptions, setMaxRedemptions] = useState("1");

  useEffect(() => {
    const prev = document.title;
    document.title = "Kelola Kode Akses | Admin Gustafta";
    return () => { document.title = prev; };
  }, []);

  const isAdmin = user?.role === "admin";

  const { data: codes = [], isLoading } = useQuery<AccessCode[]>({
    queryKey: ["/api/admin/access-codes"],
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/access-codes", {
      code: code.trim(), plan, durationDays: Number(durationDays), label: label.trim(), maxRedemptions: Number(maxRedemptions),
    }),
    onSuccess: () => {
      toast({ title: "Kode dibuat", description: "Kode akses baru siap dibagikan." });
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-codes"] });
    },
    onError: (e: any) => toast({ title: "Gagal", description: e?.message || "Coba lagi.", variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiRequest("PATCH", `/api/admin/access-codes/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/access-codes"] }),
    onError: (e: any) => toast({ title: "Gagal", description: e?.message || "Coba lagi.", variant: "destructive" }),
  });

  const copyCode = (c: string) => {
    navigator.clipboard?.writeText(c);
    toast({ title: "Disalin", description: c });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-background">
        <SharedHeader />
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-background">
        <SharedHeader />
        <div className="max-w-md mx-auto text-center py-24 px-4" data-testid="gate-admin">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mx-auto mb-5">
            <Lock className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Khusus Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Halaman ini hanya untuk admin Gustafta.</p>
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2" data-testid="btn-back">Kembali <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background" data-testid="page-admin-access-codes">
      <SharedHeader />
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center gap-2">
          <Ticket className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Kelola Kode Akses</h1>
        </div>

        {/* Buat kode */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Plus className="h-4 w-4" /> Buat Kode Baru</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Kode</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="INDOBUILDTECH2026" className="font-mono uppercase" data-testid="input-code" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="label">Label</Label>
                <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Indobuildtech 2026" data-testid="input-label" />
              </div>
              <div className="space-y-1.5">
                <Label>Tier</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger data-testid="select-plan"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dur">Durasi (hari)</Label>
                  <Input id="dur" type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} min={1} max={3650} data-testid="input-duration" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max">Kuota</Label>
                  <Input id="max" type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} min={1} data-testid="input-max" />
                </div>
              </div>
            </div>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="bg-orange-500 hover:bg-orange-600 text-white gap-2" data-testid="button-create-code">
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Buat Kode
            </Button>
          </CardContent>
        </Card>

        {/* Daftar kode */}
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white mb-3">Daftar Kode ({codes.length})</h2>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" /></div>
          ) : codes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada kode.</p>
          ) : (
            <div className="space-y-2">
              {codes.map((c) => (
                <Card key={c.id} data-testid={`row-code-${c.id}`}>
                  <CardContent className="py-3 flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => copyCode(c.code)} className="font-mono font-bold text-gray-900 dark:text-white flex items-center gap-1.5 hover:text-indigo-600" data-testid={`button-copy-${c.id}`}>
                        {c.code} <Copy className="h-3.5 w-3.5 opacity-60" />
                      </button>
                      <Badge variant="outline" className="capitalize">{c.plan}</Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{c.durationDays} hari</span>
                      {c.label && <span className="text-xs text-gray-400 truncate">{c.label}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400" data-testid={`text-usage-${c.id}`}>
                        {c.redemptionCount}/{c.maxRedemptions} terpakai
                      </span>
                      <Button
                        size="sm"
                        variant={c.active ? "outline" : "secondary"}
                        onClick={() => toggleMut.mutate({ id: c.id, active: !c.active })}
                        disabled={toggleMut.isPending}
                        data-testid={`button-toggle-${c.id}`}
                      >
                        {c.active ? "Aktif" : "Nonaktif"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
