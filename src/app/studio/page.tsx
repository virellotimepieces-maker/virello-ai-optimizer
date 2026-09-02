import { Suspense } from "react";
import { OptimizerStudio } from "@/components/optimizer-studio";

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-16 text-sm text-foreground/60">
          Loading studio…
        </div>
      }
    >
      <OptimizerStudio />
    </Suspense>
  );
}
