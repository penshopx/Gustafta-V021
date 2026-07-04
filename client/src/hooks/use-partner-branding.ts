import { useQuery } from "@tanstack/react-query";

export interface PartnerBranding {
  slug: string;
  name: string;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
  description: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  defaultAgentId: string | null;
  hidePlatformBranding: boolean;
}

/**
 * Whitelabel branding untuk host mitra (asosiasi/reseller).
 * Mengembalikan null bila host bukan mitra (host Gustafta biasa).
 */
export function usePartnerBranding() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const { data, isLoading } = useQuery<PartnerBranding | null>({
    queryKey: ["/api/partner/by-host", host],
    queryFn: async () => {
      const res = await fetch(`/api/partner/by-host?host=${encodeURIComponent(host)}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  return { partner: data ?? null, isLoading };
}
