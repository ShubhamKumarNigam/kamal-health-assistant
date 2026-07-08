"use client";
import { useEffect, useRef } from "react";
export function OtpInput({ value, onChange, onComplete, disabled = false }) {
    const refs = useRef([]);
    const completedValue = useRef("");
    const digits = value.padEnd(6, " ").slice(0, 6).split("");
    useEffect(() => {
        if (value.length < 6) {
            completedValue.current = "";
        }
        if (value.length === 6 && completedValue.current !== value) {
            completedValue.current = value;
            onComplete?.(value);
        }
    }, [onComplete, value]);
    function updateDigit(index, nextValue) {
        const cleanValue = nextValue.replace(/\D/g, "");
        if (!cleanValue) {
            const nextDigits = value.padEnd(6, " ").slice(0, 6).split("");
            nextDigits[index] = " ";
            onChange(nextDigits.join("").replace(/\s/g, ""));
            return;
        }
        const nextDigits = value.padEnd(6, " ").slice(0, 6).split("");
        cleanValue
            .slice(0, 6 - index)
            .split("")
            .forEach((digit, offset) => {
            nextDigits[index + offset] = digit;
        });
        const nextCode = nextDigits.join("").replace(/\s/g, "").slice(0, 6);
        onChange(nextCode);
        refs.current[Math.min(index + cleanValue.length, 5)]?.focus();
    }
    return (<div>
      <label className="mb-3 block font-semibold text-[#000000]">
        6-digit email code
      </label>
      <div className="grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (<input aria-label={`OTP digit ${index + 1}`} className="h-14 rounded-lg border border-[#324c4a]/20 bg-white text-center text-xl font-extrabold text-[#000000] shadow-[0_10px_25px_rgba(50,76,74,0.08)] focus:border-[#324c4a]" disabled={disabled} inputMode="numeric" key={index} maxLength={1} onChange={(event) => updateDigit(index, event.target.value)} onKeyDown={(event) => {
                if (event.key === "Backspace" && !digits[index].trim() && index > 0) {
                    refs.current[index - 1]?.focus();
                }
            }} onPaste={(event) => {
                event.preventDefault();
                updateDigit(index, event.clipboardData.getData("text"));
            }} ref={(element) => {
                refs.current[index] = element;
            }} type="text" value={digit.trim()}/>))}
      </div>
    </div>);
}
