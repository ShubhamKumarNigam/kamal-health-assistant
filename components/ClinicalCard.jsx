export function ClinicalCard({ title, children, tone = "default", variant = "default" }) {
    const isDark = variant === "dark";
    const toneClass = tone === "accent"
        ? isDark
            ? "border-l-4 border-l-[#ADF8EF]"
            : "border-l-4 border-l-accent"
        : tone === "warning"
            ? "border-l-4 border-l-warning"
            : "";
    const sectionClass = isDark
        ? `rounded-lg border border-white/12 bg-white/10 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur ${toneClass}`
        : `rounded-lg border border-border bg-surface p-5 shadow-soft ${toneClass}`;
    const titleClass = isDark ? "text-xl font-extrabold text-white" : "text-xl font-bold";
    const bodyClass = isDark ? "mt-3 font-medium leading-7 text-[#ADF8EF]" : "mt-3 leading-7 text-text-secondary";
    return (<section className={sectionClass}>
      <h2 className={titleClass}>{title}</h2>
      <div className={bodyClass}>{children}</div>
    </section>);
}
