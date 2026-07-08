const confidenceWidth = {
    Low: "w-1/3",
    Moderate: "w-2/3",
    High: "w-full"
};
export function ConfidenceMeter({ level, variant = "default" }) {
    const isDark = variant === "dark";
    return (<div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className={isDark ? "font-extrabold text-white" : "font-semibold text-text-primary"}>Confidence</span>
        <span className={isDark ? "rounded-lg bg-[#ADF8EF] px-3 py-1 font-extrabold text-primary" : "rounded-lg bg-sky-50 px-3 py-1 font-bold text-primary"}>
          {level}
        </span>
      </div>
      <div aria-label={`Confidence level ${level}`} aria-valuemax={3} aria-valuemin={1} aria-valuenow={level === "Low" ? 1 : level === "Moderate" ? 2 : 3} className={isDark ? "h-4 overflow-hidden rounded-full bg-white/14" : "h-4 overflow-hidden rounded-full bg-slate-200"} role="meter">
        <div className={`h-full rounded-full ${isDark ? "bg-[#ADF8EF]" : "bg-primary"} ${confidenceWidth[level]}`}/>
      </div>
    </div>);
}
