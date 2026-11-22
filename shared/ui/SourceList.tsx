// Fuentes como notas de pie: numeradas, con filete superior.
export function SourceList({ sources }: { sources: { label: string; url: string }[] }) {
  if (sources.length === 0) return null;
  return (
    <section aria-labelledby="fuentes" className="rule pt-4">
      <h2 id="fuentes" className="eyebrow text-text-muted">
        Fuentes
      </h2>
      <ol className="mt-3 space-y-2 text-sm">
        {sources.map((s, i) => (
          <li key={s.url} className="flex gap-3">
            <span className="w-4 shrink-0 text-text-muted tabular-nums">{i + 1}</span>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-border underline-offset-4 hover:decoration-violeta">
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
