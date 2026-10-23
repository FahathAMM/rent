import api from "@/lib/axios";

async function fetchPdfBlobUrl(path) {
  const res = await api.get(path, { responseType: "blob" });
  const blob = new Blob([res.data], { type: "application/pdf" });
  return window.URL.createObjectURL(blob);
}

/** Open a PDF in a new tab for preview — lets the user check it before printing/downloading. */
export async function viewPdf(path) {
  const url = await fetchPdfBlobUrl(path);
  window.open(url, "_blank");
  // Revoke well after opening rather than immediately — the new tab needs the
  // blob URL to still resolve while it loads the PDF.
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

/** Save a PDF to disk under the given filename. */
export async function downloadPdf(path, filename) {
  const url = await fetchPdfBlobUrl(path);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
