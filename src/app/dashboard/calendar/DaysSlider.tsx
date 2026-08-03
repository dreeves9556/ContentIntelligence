"use client";

interface DaysSliderProps {
  value: number;
  onChange: (v: number) => void;
}

export function DaysSlider({ value, onChange }: DaysSliderProps) {
  return (
    <div className="space-y-3">
      <input
        type="range"
        min={1}
        max={7}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent-primary cursor-pointer"
      />
      <div className="flex justify-between">
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className={`text-xs w-8 text-center transition-colors ${
              value === i + 1 ? "text-accent-primary font-bold" : "text-text-muted"
            }`}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <p className="text-center text-sm text-text-muted">
        <span className="text-accent-primary font-semibold text-base">{value}</span>{" "}
        day{value !== 1 ? "s" : ""} per week
      </p>
    </div>
  );
}
