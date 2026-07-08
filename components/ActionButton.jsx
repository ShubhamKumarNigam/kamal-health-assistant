import Link from "next/link";
const variants = {
    primary: "bg-primary text-white hover:bg-primary-dark",
    secondary: "bg-secondary text-white hover:bg-primary",
    light: "bg-white text-primary hover:bg-[#ADF8EF]",
    soft: "bg-[#ADF8EF] text-primary hover:bg-white",
    neutral: "border border-border bg-surface text-text-primary hover:border-primary",
    warning: "bg-warning text-slate-950 hover:bg-amber-600",
    emergency: "bg-emergency text-white hover:bg-red-700"
};
export function ActionButton({ href, label, icon: Icon, variant = "primary", type = "button" }) {
    const className = `touch-target inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-semibold transition ${variants[variant]}`;
    const content = (<>
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0"/>
      <span>{label}</span>
    </>);
    if (href) {
        return (<Link className={className} href={href}>
        {content}
      </Link>);
    }
    return (<button className={className} type={type}>
      {content}
    </button>);
}
