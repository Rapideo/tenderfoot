export type ParseResult =
  | { kind: "text"; text: string; notes: string[] }
  | { kind: "members"; members: { filename: string; bytes: Buffer }[] }
  | { kind: "unsupported"; reason: string };

const BY_EXTENSION: Record<string, "pdf" | "docx" | "xlsx" | "zip"> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  xlsm: "xlsx",
  zip: "zip",
};

/* Extension first, media type second. SAM.gov's attachment list often gives
 * `application/octet-stream` for everything, so the type is the weaker signal. */
export function parserFor(mediaType: string, filename: string): "pdf" | "docx" | "xlsx" | "zip" | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (BY_EXTENSION[ext]) return BY_EXTENSION[ext];
  if (mediaType === "application/pdf") return "pdf";
  return null;
}
