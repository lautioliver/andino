export function SourceList({ sources }: { sources: { label: string; url: string }[] }) {
  if (sources.length === 0) return null;
  return (
    <section aria-labelledby="fuentes" className="space-y-2">
      <h2 id="fuentes" className="font-display text-lg font-bold">
        Fuentes
      </h2>
      <ul className="space-y-1 text-sm">
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sky underline underline-offset-2">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
