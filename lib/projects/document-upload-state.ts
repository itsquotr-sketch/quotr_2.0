export type UploadTransfer = {
  progress: number | null;
  error: string | null;
};

/** One file's transfer never clears another file's transfer. */
export function putTransfer(
  current: Readonly<Record<string, UploadTransfer>>,
  id: string,
  next: UploadTransfer | null
): Record<string, UploadTransfer> {
  const copy: Record<string, UploadTransfer> = { ...current };
  if (next) copy[id] = next;
  else delete copy[id];
  return copy;
}
