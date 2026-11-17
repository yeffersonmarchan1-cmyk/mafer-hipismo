export type ImportedHorse = {
  legNumber: number;
  gazetteOrder: number;
  saddlecloth: number;
  name: string;
};

const ordinalLegs: Record<string, number> = {
  PRIMERA: 1,
  SEGUNDA: 2,
  TERCERA: 3,
  CUARTA: 4,
  QUINTA: 5,
  SEXTA: 6,
};

function findLegHeading(line: string): number | undefined {
  const normalized = line
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  const numbered =
    normalized.match(/\bVALIDA\s*(?:N(?:RO|UM)?\.?\s*)?([1-6])\b/) ??
    normalized.match(/\b([1-6])\s*[.)]?\s*(?:RA|DA|TA|VA|ERA|ER|ª|A)?[.)º°]?\s*VALIDA\b/);

  if (numbered) return Number(numbered[1] ?? numbered[2]);
  const worded = normalized.match(/\b(PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA)\s+VALIDA\b/);
  return worded ? ordinalLegs[worded[1]] : undefined;
}

export function parseInscriptionText(text: string): ImportedHorse[] {
  const horses = new Map<string, ImportedHorse>();
  const nextOrder = new Map<number, number>();
  let currentLeg: number | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    const heading = findLegHeading(line);
    if (heading) {
      currentLeg = heading;
      continue;
    }
    if (!currentLeg) continue;

    const entry = line.match(/^\s*(\d{1,2})\s*[.)\-:]?\s+(.+?)\s*$/);
    if (!entry) continue;

    const saddlecloth = Number(entry[1]);
    const name = entry[2]
      .replace(/\s{2,}.*/, "")
      .replace(/\s*[-–—]\s*(?:JINETE|ENTRENADOR|PESO)\b.*$/i, "")
      .replace(/[|;,]+$/, "")
      .trim();

    if (!Number.isInteger(saddlecloth) || saddlecloth < 1 || !name || name.length > 120) {
      continue;
    }
    if (/^(?:CABALLO|EJEMPLAR|NOMBRE|JINETE|ENTRENADOR)\b/i.test(name)) continue;

    const key = `${currentLeg}:${saddlecloth}`;
    const previous = horses.get(key);
    if (previous && previous.name.toLocaleUpperCase() !== name.toLocaleUpperCase()) {
      throw new Error(
        `La gualdrapa ${saddlecloth} aparece con dos nombres distintos en la válida ${currentLeg}.`,
      );
    }
    if (!previous) {
      const gazetteOrder = (nextOrder.get(currentLeg) ?? 0) + 1;
      nextOrder.set(currentLeg, gazetteOrder);
      horses.set(key, { legNumber: currentLeg, gazetteOrder, saddlecloth, name });
    }
  }

  const missingLegs = Array.from({ length: 6 }, (_, index) => index + 1).filter(
    (leg) => !Array.from(horses.values()).some((horse) => horse.legNumber === leg),
  );
  if (missingLegs.length > 0) {
    throw new Error(
      `No se encontraron inscritos en las válidas ${missingLegs.join(", ")}. Verifica que el texto incluya las seis secciones y que el PDF permita seleccionar texto.`,
    );
  }

  return Array.from(horses.values()).sort(
    (a, b) => a.legNumber - b.legNumber || a.gazetteOrder - b.gazetteOrder,
  );
}

export async function extractPdfText(file: File): Promise<string> {
  return extractDocumentText(new Uint8Array(await file.arrayBuffer()));
}

async function extractDocumentText(data: Uint8Array): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  if (pdf.numPages > 250) {
    throw new Error("El PDF supera el máximo de 250 páginas permitido para importar.");
  }
  const pages: string[] = [];
  let totalCharacters = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: { y: number; items: { x: number; text: string }[] }[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = item.transform[5];
      let line = lines.find((candidate) => Math.abs(candidate.y - y) < 2);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ x: item.transform[4], text: item.str });
    }
    const pageText = lines
      .sort((a, b) => b.y - a.y)
      .map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
      .join("\n");
    totalCharacters += pageText.length;
    if (totalCharacters > 1_000_000) {
      throw new Error("El texto extraído supera el límite de 1 MB.");
    }
    pages.push(pageText);
  }

  return pages.join("\n");
}

function validateExternalUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("El enlace no tiene un formato válido.");
  }

  const allowedHosts = (process.env.IMPORT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !allowedHosts.includes(url.hostname.toLowerCase())
  ) {
    throw new Error(
      "El enlace debe usar HTTPS y pertenecer a un dominio autorizado en IMPORT_ALLOWED_HOSTS.",
    );
  }
  return url;
}

async function readLimitedResponse(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("El archivo enlazado supera el límite de 10 MB.");
  }
  if (!response.body) throw new Error("El enlace no devolvió contenido.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("El archivo enlazado supera el límite de 10 MB.");
    }
    chunks.push(value);
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function extractLinkText(rawUrl: string): Promise<string> {
  const url = validateExternalUrl(rawUrl);
  const response = await fetch(url, {
    headers: { Accept: "application/pdf,text/html,text/plain;q=0.9,*/*;q=0.1" },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`No se pudo abrir el enlace (HTTP ${response.status}).`);

  const content = await readLimitedResponse(response, 10 * 1024 * 1024);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const isPdf =
    contentType.includes("application/pdf") ||
    (content[0] === 0x25 && content[1] === 0x50);
  if (isPdf) {
    return extractDocumentText(content);
  }

  const source = new TextDecoder().decode(content);
  if (contentType.includes("text/html") || /<html[\s>]/i.test(source)) {
    return source
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/[ \t]+/g, " ");
  }
  return source;
}
