import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CertificationType } from '@/lib/api/types';

const LABELS: Record<CertificationType, string> = {
  BIS_HALLMARK: 'BIS Hallmark',
  IGI: 'IGI Certified',
  GIA: 'GIA Certified',
  SGL: 'SGL Certified',
  HKD: 'HKD Certified',
};

export function CertificationBadge({ type }: { type: CertificationType }) {
  return (
    <Badge variant="accent" className="gap-1">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {LABELS[type]}
    </Badge>
  );
}
