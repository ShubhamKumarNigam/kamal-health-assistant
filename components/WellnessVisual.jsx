import Image from "next/image";
export function WellnessVisual() {
    return (<div className="overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
      <Image alt="A person meditating in a forest with sunlight streaming through the trees" className="h-auto w-full" height={720} priority src="/pinterest-meditation.png" width={1080}/>
    </div>);
}
