"use client";

import { Input } from "@/components/ui/input";

interface MoneyInputProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function MoneyInput({
  value,
  onChange,
  disabled = false,
  className = "",
  placeholder = "0 ₫",
}: MoneyInputProps) {
  const displayValue = value === 0 ? "" : `${value.toLocaleString("vi-VN")} ₫`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    
    // Strip everything except digits
    const digitsOnly = rawVal.replace(/\D/g, "");
    
    if (digitsOnly === "") {
      onChange(0);
      return;
    }

    const numericVal = parseInt(digitsOnly, 10);
    
    if (isNaN(numericVal)) {
      onChange(0);
      return;
    }

    onChange(numericVal);
  };

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
      />
    </div>
  );
}
