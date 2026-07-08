export function VoiceField({ label, placeholder, multiline = false, type = "text", name, value, onChange, autoComplete, inputMode, required = false }) {
    const fieldClass = "min-h-12 w-full rounded-lg border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary focus:border-primary";
    return (<label className="block">
      <span className="mb-2 block font-semibold">{label}</span>
      {multiline ? (<textarea autoComplete={autoComplete} className={fieldClass} inputMode={inputMode} name={name} onChange={onChange} placeholder={placeholder} required={required} rows={4} value={value}/>) : (<input autoComplete={autoComplete} className={fieldClass} inputMode={inputMode} name={name} onChange={onChange} placeholder={placeholder} required={required} type={type} value={value}/>)}
    </label>);
}
