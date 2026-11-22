// Isotipo de ANDINO, PROVISORIO (docs/design.md §12): órbita incompleta, estrella de 4 puntas y dos cumbres.
// La órbita y la estrella toman el color del texto (Noche en la página clara, Nube en un bloque .oscuro);
// las cumbres van en Puna. Dos colores visibles, sin degradado.
export function AndinoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden focusable="false" className={className}>
      <path d="M10 40 A24 24 0 1 1 50 47" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M44 7 L46.8 15.2 L55 18 L46.8 20.8 L44 29 L41.2 20.8 L33 18 L41.2 15.2 Z" fill="currentColor" />
      <path d="M14 52 L25 36 L31 44 L37 38 L48 52 Z" fill="var(--puna)" />
    </svg>
  );
}
