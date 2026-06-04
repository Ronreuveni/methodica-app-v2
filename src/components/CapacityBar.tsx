export function CapacityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value > 0.9 ? '#D65046' : value > 0.7 ? '#EC8223' : '#7DA842';
  return (
    <div className="h-1.5 bg-bg-muted rounded overflow-hidden" title={pct + '%'}>
      <div className="h-full transition-all" style={{ width: Math.min(100, pct) + '%', background: color }}/>
    </div>
  );
}
