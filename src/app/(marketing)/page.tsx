import { Hero } from "@/components/marketing/hero";
import { TrustedFeatures } from "@/components/marketing/trusted-features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { CtaSection } from "@/components/marketing/cta-section";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <TrustedFeatures />
      <HowItWorks />
      <FeatureGrid />
      <CtaSection />
    </div>
  );
}
