export function PhotoCredit({ credit, url }: { credit: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted underline-offset-2 hover:underline">
      Foto: {credit}
    </a>
  );
}
