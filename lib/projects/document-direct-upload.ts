/**
 * Browser upload straight to the private project-document bucket.
 * Bytes do not pass through a Server Action.
 */

export function uploadProjectDocumentToSignedUrl(input: {
  signedUrl: string;
  file: File;
  upsert: boolean;
  onProgress: (percent: number | null) => void;
  signal: AbortSignal;
}): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let target: URL;
  try {
    target = new URL(input.signedUrl);
  } catch {
    return Promise.reject(new Error("UPLOAD_URL"));
  }
  if (
    !supabaseUrl ||
    target.host !== new URL(supabaseUrl).host ||
    !target.pathname.includes("/object/upload/sign/") ||
    target.protocol !== "https:"
  ) {
    return Promise.reject(new Error("UPLOAD_URL"));
  }

  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", input.file);
    const xhr = new XMLHttpRequest();
    const fail = () => reject(new Error("UPLOAD_FAILED"));
    xhr.open("PUT", target.toString());
    xhr.setRequestHeader("x-upsert", input.upsert ? "true" : "false");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) xhr.setRequestHeader("apikey", anonKey);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        input.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      } else {
        input.onProgress(null);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else fail();
    };
    xhr.onerror = fail;
    xhr.onabort = () => reject(new Error("ABORTED"));
    input.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    if (input.signal.aborted) {
      reject(new Error("ABORTED"));
      return;
    }
    xhr.send(body);
  });
}
