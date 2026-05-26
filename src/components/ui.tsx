import type { ReactNode } from "react";

export function Card({
  title,
  topRight,
  children,
  tone = "default",
  className = "",
}: {
  title?: ReactNode;
  topRight?: ReactNode;
  children: ReactNode;
  tone?: "default" | "highlight" | "warn";
  className?: string;
}) {
  const toneCls =
    tone === "highlight"
      ? "border-rosey-300 bg-rosey-50/40"
      : tone === "warn"
      ? "border-rosey-300 bg-cream-50"
      : "border-ink/15 bg-cream-50";
  return (
    <div className={`rounded-md border ${toneCls} p-5 ${className}`}>
      {(title || topRight) && (
        <div className="flex items-center justify-between mb-3">
          {title && <div className="label-xs">{title}</div>}
          {topRight}
        </div>
      )}
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "rose" | "sage" | "ambr" | "sky" | "lila";
  className?: string;
}) {
  const map: Record<string, string> = {
    default: "border-ink/30 text-ink-soft bg-cream-50",
    rose: "border-rosey-300 text-rosey-400 bg-rosey-50",
    sage: "border-sage-300 text-sage-300 bg-sage-100/60",
    ambr: "border-ambr-300 text-ambr-300 bg-ambr-100/60",
    sky: "border-skyy-300 text-skyy-300 bg-skyy-100/60",
    lila: "border-lila-300 text-lila-300 bg-lila-100/60",
  };
  return <span className={`pill ${map[tone]} ${className}`}>{children}</span>;
}

export function Sparkline({
  data,
  color = "#C97A8B",
  height = 36,
  width = 120,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y] as const;
  });
  const path = points.reduce((acc, [x, y], i) => acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`), "");
  return (
    <svg width={width} height={height} className="spark">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

export function Avatar({ initial, tone = "rose" }: { initial: string; tone?: "rose" | "sage" | "sky" | "lila" | "ambr" }) {
  const map: Record<string, string> = {
    rose: "bg-rosey-100 border-rosey-300",
    sage: "bg-sage-100 border-sage-300",
    sky: "bg-skyy-100 border-skyy-300",
    lila: "bg-lila-100 border-lila-300",
    ambr: "bg-ambr-100 border-ambr-300",
  };
  return (
    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold ${map[tone]}`}>
      {initial}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 border border-ink/20 rounded-md p-0.5 bg-cream-50">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={
            "px-3 py-1 text-sm rounded-[5px] transition-colors " +
            (value === o.value ? "bg-rosey-100 text-ink" : "text-ink-soft hover:bg-cream-100")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
