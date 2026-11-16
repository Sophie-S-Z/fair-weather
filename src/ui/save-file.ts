// Files the game makes and reads on the device (ADR 0014 items 7 and 8): it sends nothing.

/** Saves `blob` as a download named `name`: an object URL and an `a download`, revoked after. */
export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // After the click's task, so every engine has started the download.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * The `v1.<data>` text of the valley file picked in `input`: its line, trimmed and nothing else;
 * null when no file is picked. A file over `maxBytes`, which no link is, gives '' unread, and so
 * does a file that cannot be read: no link decodes from ''.
 */
export async function readValleyFile(input: HTMLInputElement, maxBytes: number): Promise<string | null> {
  const file = input.files?.[0];
  if (!file) return null;
  if (file.size > maxBytes) return '';
  try {
    return (await file.text()).trim();
  } catch {
    return '';
  }
}
