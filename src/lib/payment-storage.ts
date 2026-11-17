import "server-only";

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

function storagePath(bucket: string, key: string) {
  return [bucket, ...key.split("/")].map(encodeURIComponent).join("/");
}

function headers(serviceRoleKey: string, contentType?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

async function assertPrivateBucket(response: Response) {
  if (!response.ok) {
    throw new Error("No se pudo verificar el bucket de comprobantes en Supabase Storage.");
  }
  const bucket: unknown = await response.json();
  if (!bucket || typeof bucket !== "object" || !("public" in bucket) || bucket.public !== false) {
    throw new Error("El bucket de comprobantes existe, pero no está configurado como privado.");
  }
}

async function ensurePrivateBucket(baseUrl: string, serviceRoleKey: string) {
  const response = await fetch(`${baseUrl}/storage/v1/bucket/${defaultBucket}`, {
    headers: headers(serviceRoleKey),
    cache: "no-store",
    redirect: "error",
  });
  if (response.ok) {
    await assertPrivateBucket(response);
    return;
  }
  if (response.status !== 404) {
    throw new Error("No se pudo verificar el bucket privado de comprobantes en Supabase Storage.");
  }

  const create = await fetch(`${baseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      ...headers(serviceRoleKey, "application/json"),
    },
    body: JSON.stringify({
      id: defaultBucket,
      name: defaultBucket,
      public: false,
      file_size_limit: maximumProofSize,
      allowed_mime_types: [...allowedTypes.keys()],
    }),
    cache: "no-store",
    redirect: "error",
  });
  if (!create.ok && create.status !== 409) {
    throw new Error("No se pudo crear el bucket privado de comprobantes en Supabase Storage.");
  }
  if (create.status === 409) {
    const verify = await fetch(`${baseUrl}/storage/v1/bucket/${defaultBucket}`, {
      headers: headers(serviceRoleKey),
      cache: "no-store",
      redirect: "error",
    });
    await assertPrivateBucket(verify);
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

  const { baseUrl, serviceRoleKey } = storageCredentials();
  await ensurePrivateBucket(baseUrl, serviceRoleKey);
  const key = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  const response = await fetch(
    `${baseUrl}/storage/v1/object/${storagePath(defaultBucket, key)}`,
    {
      method: "POST",
      headers: {
        ...headers(serviceRoleKey, file.type),
        "x-upsert": "false",
        "cache-control": "3600",
      },
      body: bytes,
      cache: "no-store",
      redirect: "error",
    },
  );
  if (!response.ok) {
    throw new Error("Supabase Storage no pudo guardar el comprobante. Intenta de nuevo.");
  }
  return {
    bucket: defaultBucket,
    key,
    contentType: file.type,
    fileSizeBytes: file.size,
  };
}

export async function deletePaymentProof(bucket: string, key: string) {
  const { baseUrl, serviceRoleKey } = storageCredentials();
  const response = await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers: headers(serviceRoleKey, "application/json"),
    body: JSON.stringify({ prefixes: [key] }),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error("No se pudo eliminar el comprobante temporal de Supabase Storage.");
  }
}

export async function createPaymentProofUrl(bucket: string, key: string) {
  const { baseUrl, serviceRoleKey } = storageCredentials();
  const response = await fetch(
    `${baseUrl}/storage/v1/object/sign/${storagePath(bucket, key)}`,
    {
      method: "POST",
      headers: headers(serviceRoleKey, "application/json"),
      body: JSON.stringify({ expiresIn: 120 }),
      cache: "no-store",
      redirect: "error",
    },
  );
  if (!response.ok) {
    throw new Error("No se pudo generar un enlace temporal al comprobante.");
  }
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("signedURL" in body) ||
    typeof body.signedURL !== "string"
  ) {
    throw new Error("Supabase Storage devolvió un enlace temporal inválido.");
  }
  const signedUrl = body.signedURL.startsWith("http")
    ? new URL(body.signedURL)
    : new URL(
        body.signedURL.startsWith("/storage/v1/")
          ? body.signedURL
          : `/storage/v1${body.signedURL.startsWith("/") ? "" : "/"}${body.signedURL}`,
        baseUrl,
      );
  if (signedUrl.origin !== new URL(baseUrl).origin) {
    throw new Error("Supabase Storage devolvió un enlace a un dominio inesperado.");
  }
  return signedUrl.toString();
}

export const paymentProofMaxBytes = maximumProofSize;
