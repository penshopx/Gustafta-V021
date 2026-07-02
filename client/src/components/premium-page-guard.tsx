import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lock, LogIn, Zap, ArrowRight, Crown, Star, Shield,
  Brain, Cpu, Bot, Sparkles, CheckCircle2, MessageCircle, Phone,
  LayoutGrid, PackageOpen
} from "lucide-react";
import { useFeatureAccess, type FeatureKey, type PlanTier, PLAN_CONFIGS, FEATURE_LABELS } from "@/hooks/use-feature-access";
import { useClawPackages, packageForRoute } from "@/hooks/use-claw-packages";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const WA_TRIAL_NUMBER = "6281287941900";
const WA_TRIAL_NUMBER_2 = "6282299417818";

interface PremiumPageGuardProps {
  feature: FeatureKey;
  requiredPlan?: PlanTier;
  title: string;
  description: string;
  highlights?: string[];
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PremiumPageGuard({
  feature,
  requiredPlan = "starter",
  title,
  description,
  highlights = [],
  icon,
  children,
  className,
}: PremiumPageGuardProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasFeature, planInfo } = useFeatureAccess();
  const [location] = useLocation();
  const routePackage = packageForRoute(location);
  const clawPkgQuery = useClawPackages();

  // Admin/SuperAdmin bypass — check role from /api/admin/me
  const { data: adminData, isLoading: adminLoading } = useQuery<{
    isAdmin: boolean;
    isSuperAdmin: boolean;
    role: string;
  }>({
    queryKey: ["/api/admin/me"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const isSuperAdmin = adminData?.isSuperAdmin === true;

  if (authLoading || adminLoading || planInfo.status === "loading" || (isAuthenticated && routePackage && clawPkgQuery.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          <p className="text-sm text-muted-foreground">Memeriksa akses…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LockedScreen
        title={title}
        description={description}
        highlights={highlights}
        icon={icon}
        reason="auth"
        requiredPlan={requiredPlan}
        className={className}
      />
    );
  }

  // Only SuperAdmin gets full bypass — regular admin still needs subscription
  if (isSuperAdmin) return <>{children}</>;

  // ── Paket bidang: route claw yang termasuk paket bidang ──
  // Bisnis/Enterprise (allowance "all") → buka semua paket.
  // Profesional (allowance > 0) → buka HANYA claw di paket terpilih (termasuk claw yang dulunya khusus Bisnis).
  // Tier di bawahnya → jatuh ke pengecekan fitur biasa (upsell lama).
  if (routePackage) {
    const { allowance, selected } = clawPkgQuery.info;
    if (allowance === "all") return <>{children}</>;
    if (typeof allowance === "number" && allowance > 0) {
      if (selected.includes(routePackage.id)) return <>{children}</>;
      return (
        <PackageLockedScreen
          title={title}
          description={description}
          icon={icon}
          packageName={routePackage.name}
          hasSelection={selected.length > 0}
          className={className}
        />
      );
    }
  }

  if (!hasFeature(feature)) {
    return (
      <LockedScreen
        title={title}
        description={description}
        highlights={highlights}
        icon={icon}
        reason="plan"
        requiredPlan={requiredPlan}
        className={className}
      />
    );
  }

  return <>{children}</>;
}

interface PackageLockedScreenProps {
  title: string;
  description: string;
  icon?: ReactNode;
  packageName: string;
  hasSelection: boolean;
  className?: string;
}

function PackageLockedScreen({ title, description, icon, packageName, hasSelection, className }: PackageLockedScreenProps) {
  return (
    <div className={cn("min-h-screen bg-background flex flex-col", className)}>
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full text-center space-y-8">

          <div className="relative flex justify-center">
            <div className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center text-4xl shadow-lg">
              {icon ?? <Bot className="h-12 w-12 text-muted-foreground" />}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow">
              <PackageOpen className="h-5 w-5 text-indigo-500" />
            </div>
          </div>

          <div className="space-y-3">
            <Badge className="gap-1.5 px-3 py-1 text-xs font-semibold bg-indigo-500/10 text-indigo-500 border border-indigo-500/30">
              <LayoutGrid className="h-3.5 w-3.5" />
              Paket Bidang: {packageName}
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-base leading-relaxed">{description}</p>
          </div>

          <div className="bg-muted/40 rounded-2xl p-5 border border-border/50 text-sm text-muted-foreground leading-relaxed">
            {hasSelection ? (
              <>Claw ini termasuk paket bidang <span className="font-semibold text-foreground">{packageName}</span> yang belum ada di pilihan Anda. Pilihan paket bidang terkunci setelah disimpan — hubungi admin jika ingin mengganti.</>
            ) : (
              <>Claw ini termasuk paket bidang <span className="font-semibold text-foreground">{packageName}</span>. Paket Profesional Anda memberi jatah memilih paket bidang — pilih sekarang untuk membuka claw ini.</>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/paket-bidang">
              <Button size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-pilih-paket-bidang">
                <LayoutGrid className="h-4 w-4" />
                {hasSelection ? "Lihat Paket Bidang Saya" : "Pilih Paket Bidang"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/multiclaw">
              <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-back-directory">
                <Cpu className="h-4 w-4" />
                Direktori MultiClaw
              </Button>
            </Link>
          </div>

          {hasSelection && (
            <p className="text-xs text--muted-foreground text-muted-foreground">
              Ingin akses semua bidang tanpa memilih? Upgrade ke paket Bisnis.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface LockedScreenProps {
  title: string;
  description: string;
  highlights: string[];
  icon?: ReactNode;
  reason: "auth" | "plan";
  requiredPlan: PlanTier;
  className?: string;
}

function buildWaMessage(title: string, reason: "auth" | "plan", requiredPlan: PlanTier) {
  const planConfig = PLAN_CONFIGS[requiredPlan];
  if (reason === "auth") {
    return encodeURIComponent(
      `Halo, saya ingin coba trial ${title} di Gustafta. Bagaimana caranya?`
    );
  }
  return encodeURIComponent(
    `Halo, saya sudah login di Gustafta dan ingin mengajukan trial ${title} (Paket ${planConfig.name}). Apakah tersedia?`
  );
}

function LockedScreen({ title, description, highlights, icon, reason, requiredPlan, className }: LockedScreenProps) {
  const planConfig = PLAN_CONFIGS[requiredPlan];
  const waMsg = buildWaMessage(title, reason, requiredPlan);
  const waUrl1 = `https://wa.me/${WA_TRIAL_NUMBER}?text=${waMsg}`;
  const waUrl2 = `https://wa.me/${WA_TRIAL_NUMBER_2}?text=${waMsg}`;

  return (
    <div className={cn("min-h-screen bg-background flex flex-col", className)}>
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full text-center space-y-8">

          <div className="relative flex justify-center">
            <div className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center text-4xl shadow-lg">
              {icon ?? <Bot className="h-12 w-12 text-muted-foreground" />}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow">
              <Lock className="h-5 w-5 text-amber-500" />
            </div>
          </div>

          <div className="space-y-3">
            <Badge
              className="gap-1.5 px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: `${planConfig.color}15`,
                color: planConfig.color,
                border: `1px solid ${planConfig.color}30`,
              }}
            >
              <Crown className="h-3.5 w-3.5" />
              {reason === "auth" ? "Login Diperlukan" : `Perlu Paket ${planConfig.name}`}
            </Badge>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-base leading-relaxed">{description}</p>
          </div>

          {highlights.length > 0 && (
            <div className="bg-muted/40 rounded-2xl p-5 text-left space-y-3 border border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fitur yang tersedia:</p>
              <ul className="space-y-2.5">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {reason === "auth" ? (
              <>
                <a href="/login">
                  <Button size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-login-access">
                    <LogIn className="h-4 w-4" />
                    Masuk untuk Akses
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
                <Link href="/pricing">
                  <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-see-pricing">
                    <Star className="h-4 w-4" />
                    Lihat Paket
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/onboarding">
                  <Button
                    size="lg"
                    className="gap-2 w-full sm:w-auto"
                    style={{ backgroundColor: planConfig.color }}
                    data-testid="button-upgrade-premium"
                  >
                    <Zap className="h-4 w-4" />
                    Upgrade ke {planConfig.name}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/my-subscription">
                  <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-my-subscription">
                    <Crown className="h-4 w-4" />
                    Paket Saya
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Trial via WhatsApp */}
          <div className="rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-5 space-y-3">
            <div className="flex items-center justify-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                Ingin coba trial dulu? Hubungi kami langsung
              </p>
            </div>
            <p className="text-xs text-green-700 dark:text-green-400">
              Kami siapkan akses trial untuk Anda — cukup kirim pesan, admin akan aktifkan dalam hitungan jam.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <a href={waUrl1} target="_blank" rel="noopener noreferrer">
                <Button
                  size="sm"
                  className="gap-2 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-wa-trial-1"
                >
                  <Phone className="h-3.5 w-3.5" />
                  081287941900
                </Button>
              </a>
              <a href={waUrl2} target="_blank" rel="noopener noreferrer">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 w-full sm:w-auto border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                  data-testid="button-wa-trial-2"
                >
                  <Phone className="h-3.5 w-3.5" />
                  082299417818
                </Button>
              </a>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {reason === "auth"
              ? "Sudah punya akun? Masuk sekarang. Belum punya? Daftar gratis, lalu hubungi kami untuk trial."
              : `Saat ini Anda di paket gratis. Upgrade ke ${planConfig.name} (Rp ${planConfig.monthlyFee.toLocaleString("id")}/bln) atau minta trial via WhatsApp.`}
          </p>

        </div>
      </div>
    </div>
  );
}
