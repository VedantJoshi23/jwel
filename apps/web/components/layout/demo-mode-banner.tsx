// Shown when the deployment is running with simulated payments, i.e. the API
// has PAYMENTS_MODE=simulated and checkout completes without taking money.
//
// Must be kept in step with the API flag by hand — this is a NEXT_PUBLIC_*
// value inlined at build time, while PAYMENTS_MODE is read by the API at
// runtime. They are two different mechanisms and nothing enforces agreement,
// so RUNBOOK §13 flips them together. A banner shown over a live gateway is
// merely embarrassing; a live-looking checkout that takes no money is not.
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function DemoModeBanner() {
  if (!isDemoMode) return null;

  return (
    // role="status" rather than "alert": this is ambient context, and an alert
    // would interrupt a screen reader mid-navigation on every page load.
    <div
      role="status"
      className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      Demo store — orders are for preview only. No payment is taken and nothing will be shipped.
    </div>
  );
}
