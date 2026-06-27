import { cn } from '@/lib/utils';

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr role="separator" className={cn('border-border', className)} {...props} />;
}
