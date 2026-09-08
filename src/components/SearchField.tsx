export function SearchField({
  value,
  onChange,
  id = 'market-search',
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <label htmlFor={id} className="sr-only">
        Search markets
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name or symbol"
        className="h-11 w-full rounded-control border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-ink"
      />
    </div>
  );
}
