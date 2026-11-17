import "server-only";

import { createClient } from "@supabase/supabase-js";

const defaultBucket = "payment-proofs";
const maximumProofSize = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function storageCredentials() {
  const projectUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!projectUrl || !serviceRoleKey) {
    throw new Error(
      "La carga segura requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY configurados solo en el servidor.",
    );
  }
  let url: URL;
  try {
    url = new URL(projectUrl);
  } catch {
    throw new Error("SUPABASE_URL no es una URL válida.");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "" && url.pathname !== "/")
  ) {
    throw new Error("SUPABASE_URL debe contener solo el origen del proyecto.");
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_URL debe usar HTTPS en producción.");
  }
  return { baseUrl: url.origin, serviceRoleKey };
}

function createStorageClient() {
  const { baseUrl, serviceRoleKey } = storageCredentials();
  return {
    baseUrl,
    client: createClient(baseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    }),
  };
}

async function ensurePrivateBucket(client: ReturnType<typeof createStorageClient>["client"]) {
  const { data: bucket, error } = await client.storage.getBucket(defaultBucket);
  if (!error) {
    if (bucket.public) {
      throw new Error("El bucket de comprobantes existe, pero no está configurado como privado.");
    }
    return;
  }

  const missing =
    error.statusCode === "404" || error.message.toLowerCase().includes("bucket not found");
  if (!missing) {
    return;
  }

  const { error: createError } = await client.storage.createBucket(defaultBucket, {
    public: false,
    fileSizeLimit: maximumProofSize,
    allowedMimeTypes: [...allowedTypes.keys()],
  });
  if (!createError) {
    return;
  }

  const { data: existingBucket, error: verifyError } =
    await client.storage.getBucket(defaultBucket);
  if (!verifyError && existingBucket.public) {
    throw new Error("El bucket de comprobantes existe, pero no está configurado como privado.");
  }
}

function isValidImage(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    type === "image/webp" &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

export async function uploadPaymentProof(
  file: File,
  ownerId: string,
): Promise<{ bucket: string; key: string; contentType: string; fileSizeBytes: number }> {
  const extension = allowedTypes.get(file.type);
  if (!extension) {
    throw new Error("El comprobante debe ser una imagen JPG, PNG o WebP.");
  }
  if (file.size < 1 || file.size > maximumProofSize) {
    throw new Error("La imagen del comprobante debe pesar como máximo 5 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isValidImage(file.type, bytes)) {
    throw new Error("El contenido del archivo no coincide con una imagen JPG, PNG o WebP válida.");
  }

  const { client } = createStorageClient();
  await ensurePrivateBucket(client);
  const key = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(defaultBucket).upload(key, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    const status = error.statusCode ? ` (${error.statusCode})` : "";
    throw new Error(`Supabase Storage no pudo guardar el comprobante: ${error.message}${status}`);
  }
  return {
    bucket: defaultBucket,
    key,
    contentType: file.type,
    fileSizeBytes: file.size,
  };
}

export async function deletePaymentProof(bucket: string, key: string) {
  const { client } = createStorageClient();
  const { error } = await client.storage.from(bucket).remove([key]);
  if (error && error.statusCode !== "404") {
    throw new Error(`No se pudo eliminar el comprobante temporal de Supabase Storage: ${error.message}`);
  }
}

export async function createPaymentProofUrl(bucket: string, key: string) {
  const { baseUrl, client } = createStorageClient();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(key, 120);
  if (error) {
    throw new Error(`No se pudo generar un enlace temporal al comprobante: ${error.message}`);
  }
  const signedUrl = new URL(data.signedUrl, `${baseUrl}/`);
  if (signedUrl.origin !== new URL(baseUrl).origin) {
    throw new Error("Supabase Storage devolvió un enlace a un dominio inesperado.");
  }
  return signedUrl.toString();
}

export const paymentProofMaxBytes = maximumProofSize;
