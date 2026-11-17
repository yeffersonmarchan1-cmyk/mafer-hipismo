const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const zlib = require("node:zlib");
const { Prisma, PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const bucketName = "payment-proofs";
const migrationTable = "_prisma_migrations";
const maximumBackupBytes = 250 * 1024 * 1024;
const backupFormat = "mafer-hipismo-encrypted-backup-v1";

function getEncryptionKey() {
  const raw = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "Define BACKUP_ENCRYPTION_KEY con una clave aleatoria de 32 bytes antes de respaldar.",
    );
  }
  const key =
    /^[a-f0-9]{64}$/i.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "BACKUP_ENCRYPTION_KEY debe ser una clave de 32 bytes codificada en base64 o 64 caracteres hexadecimales.",
    );
  }
  return key;
}

function createStorageClient(url, key) {
  return createClient(url, key, { auth: { persistSession: false } });
}

function databaseMatchesProject(databaseUrl, projectRef) {
  const username = decodeURIComponent(databaseUrl.username);
  return (
    databaseUrl.hostname === `db.${projectRef}.supabase.co` ||
    (databaseUrl.hostname.endsWith(".pooler.supabase.com") &&
      username.split(".").includes(projectRef))
  );
}

function encode(value) {
  if (typeof value === "bigint") {
    return { $type: "BigInt", value: value.toString() };
  }
  if (value instanceof Date) {
    return { $type: "DateTime", value: value.toISOString() };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { $type: "Bytes", value: Buffer.from(value).toString("base64") };
  }
  if (Prisma.Decimal.isDecimal(value)) {
    return { $type: "Decimal", value: value.toFixed() };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, encode(item)]),
    );
  }
  return value;
}

function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    switch (value.$type) {
      case "BigInt":
        return BigInt(value.value);
      case "DateTime":
        return new Date(value.value);
      case "Bytes":
        return Buffer.from(value.value, "base64");
      case "Decimal":
        return new Prisma.Decimal(value.value);
      default:
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, decode(item)]),
        );
    }
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function protectBackupDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    fs.chmodSync(directory, 0o700);
    return;
  }
  const { spawnSync } = require("node:child_process");
  const sid = os.userInfo().username;
  const result = spawnSync(
    "icacls",
    [directory, "/inheritance:r", "/grant:r", `${sid}:(OI)(CI)F`, "*S-1-5-18:(OI)(CI)F"],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error("No se pudieron restringir los permisos del respaldo.");
  }
}

async function listStorageFiles(client, prefix = "") {
  const files = [];
  const folders = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage
      .from(bucketName)
      .list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw new Error(`No se pudo listar Storage: ${error.message}`);
    for (const item of data || []) {
      const key = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) folders.push(key);
      else files.push({ key, metadata: item.metadata || null });
    }
    if (!data || data.length < 100) break;
  }
  for (const folder of folders) {
    files.push(...(await listStorageFiles(client, folder)));
  }
  return files;
}

function encrypt(bytes, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    format: backupFormat,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

async function decryptArchive(filePath) {
  if (fs.statSync(filePath).size > maximumBackupBytes) {
    throw new Error("El archivo de respaldo excede el límite local de 250 MB.");
  }
  const envelope = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (
    envelope.format !== backupFormat ||
    envelope.algorithm !== "aes-256-gcm" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.authTag !== "string" ||
    typeof envelope.ciphertext !== "string"
  ) {
    throw new Error("El archivo no es un respaldo cifrado reconocido.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  const compressed = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  const snapshot = JSON.parse((await gunzip(compressed)).toString("utf8"));
  validateSnapshot(snapshot);
  return snapshot;
}

function validateSnapshot(snapshot) {
  if (
    snapshot.format !== "mafer-hipismo-production-backup-v1" ||
    !snapshot.database?.tables ||
    !snapshot.database?.tableCounts ||
    typeof snapshot.database.projectRef !== "string" ||
    !Array.isArray(snapshot.storage?.files) ||
    snapshot.storage.bucket !== bucketName
  ) {
    throw new Error("El respaldo no tiene un formato de datos válido.");
  }
  for (const [table, count] of Object.entries(snapshot.database.tableCounts)) {
    if (
      !Array.isArray(snapshot.database.tables[table]) ||
      snapshot.database.tables[table].length !== count
    ) {
      throw new Error(`La verificación del respaldo falló en ${table}.`);
    }
  }
  for (const file of snapshot.storage.files) {
    const bytes = Buffer.from(file.contentBase64 || "", "base64");
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) {
      throw new Error("La verificación de integridad de un comprobante falló.");
    }
  }
}

async function createBackup() {
  const key = getEncryptionKey();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const storageUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!databaseUrl || !storageUrl || !serviceRoleKey) {
    throw new Error(
      "Define DATABASE_URL, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.",
    );
  }
  const database = new URL(databaseUrl);
  const projectUrl = new URL(storageUrl);
  if (
    projectUrl.protocol !== "https:" ||
    !projectUrl.hostname.endsWith(".supabase.co") ||
    projectUrl.hostname.split(".").length !== 3 ||
    !["postgres:", "postgresql:"].includes(database.protocol)
  ) {
    throw new Error("La conexión de Storage debe usar HTTPS y la base PostgreSQL.");
  }
  const projectRef = projectUrl.hostname.split(".")[0];
  if (!databaseMatchesProject(database, projectRef)) {
    throw new Error("La base de datos no coincide con el proyecto Supabase de Storage.");
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: database.toString() } },
  });
  try {
    const identity = await prisma.$queryRawUnsafe(
      "SELECT current_database() AS database",
    );
    const tableRows = await prisma.$queryRawUnsafe(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const applicationTables = new Set(
      Prisma.dmmf.datamodel.models.map((model) => model.dbName || model.name),
    );
    const backupTableRows = tableRows.filter(
      ({ tablename }) =>
        tablename === migrationTable || applicationTables.has(tablename),
    );
    const columnRows = await prisma.$queryRawUnsafe(
      "SELECT table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position",
    );
    const schema = {};
    for (const column of columnRows) {
      if (
        column.table_name !== migrationTable &&
        !applicationTables.has(column.table_name)
      ) {
        continue;
      }
      (schema[column.table_name] ||= []).push(encode(column));
    }
    const tables = {};
    const tableCounts = {};
    await prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRawUnsafe(
          "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
        );
        for (const { tablename } of backupTableRows) {
          if (!/^[A-Za-z0-9_]+$/.test(tablename)) {
            throw new Error("Se encontró un nombre de tabla inesperado.");
          }
          const rows = await transaction.$queryRawUnsafe(
            `SELECT * FROM public."${tablename}"`,
          );
          tables[tablename] = rows.map(encode);
          tableCounts[tablename] = rows.length;
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 120000,
      },
    );

    const storage = createStorageClient(projectUrl.origin, serviceRoleKey);
    const { data: bucket, error: bucketError } =
      await storage.storage.getBucket(bucketName);
    if (bucketError) throw new Error(`Bucket de comprobantes: ${bucketError.message}`);
    if (bucket.public) throw new Error("El bucket de comprobantes debe ser privado.");
    const files = [];
    let totalStorageBytes = 0;
    for (const file of await listStorageFiles(storage)) {
      const { data, error } = await storage.storage
        .from(bucketName)
        .download(file.key);
      if (error) throw new Error(`No se pudo respaldar un comprobante: ${error.message}`);
      const bytes = Buffer.from(await data.arrayBuffer());
      totalStorageBytes += bytes.length;
      if (totalStorageBytes > maximumBackupBytes) {
        throw new Error("El respaldo excede el límite local de 250 MB.");
      }
      files.push({
        key: file.key,
        size: bytes.length,
        contentType: data.type || null,
        metadata: encode(file.metadata),
        sha256: sha256(bytes),
        contentBase64: bytes.toString("base64"),
      });
    }

    const snapshot = {
      format: "mafer-hipismo-production-backup-v1",
      createdAt: new Date().toISOString(),
      database: {
        name: identity[0].database,
        projectRef,
        tables,
        tableCounts,
        schema,
      },
      storage: { bucket: bucketName, files },
    };
    validateSnapshot(snapshot);
    const compressed = await gzip(Buffer.from(JSON.stringify(snapshot)), {
      level: 9,
    });
    if (compressed.length > maximumBackupBytes) {
      throw new Error("El respaldo comprimido excede el límite local de 250 MB.");
    }
    const envelope = encrypt(compressed, key);
    const envelopeJson = JSON.stringify(envelope);
    if (Buffer.byteLength(envelopeJson) > maximumBackupBytes) {
      throw new Error("El archivo cifrado excede el límite local de 250 MB.");
    }
    const outputDirectory = path.resolve(
      process.env.BACKUP_OUTPUT_DIR || "backups",
    );
    protectBackupDirectory(outputDirectory);
    const fileName = `mafer-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.backup.enc`;
    const outputPath = path.join(outputDirectory, fileName);
    fs.writeFileSync(outputPath, envelopeJson, {
      flag: "wx",
      mode: 0o600,
    });
    if (process.platform !== "win32") fs.chmodSync(outputPath, 0o600);
    await decryptArchive(outputPath);
    console.log(
      JSON.stringify({
        backupVerified: true,
        outputPath,
        databaseTables: Object.keys(tableCounts).length,
        databaseRows: Object.values(tableCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
        proofFiles: files.length,
        proofBytes: totalStorageBytes,
        encryptedBytes: fs.statSync(outputPath).size,
        encryptedSha256: sha256(fs.readFileSync(outputPath)),
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyBackup(filePath) {
  if (!filePath) throw new Error("Indica la ruta de un archivo .backup.enc.");
  const snapshot = await decryptArchive(path.resolve(filePath));
  console.log(
    JSON.stringify({
      backupVerified: true,
      createdAt: snapshot.createdAt,
      projectRef: snapshot.database.projectRef,
      databaseTables: Object.keys(snapshot.database.tableCounts).length,
      databaseRows: Object.values(snapshot.database.tableCounts).reduce(
        (sum, count) => sum + count,
        0,
      ),
      proofFiles: snapshot.storage.files.length,
      proofBytes: snapshot.storage.files.reduce(
        (sum, file) => sum + file.size,
        0,
      ),
    }),
  );
}

if (require.main === module) {
  const [command, backupPath] = process.argv.slice(2);
  const operation =
    command === "verify" ? verifyBackup(backupPath) : createBackup();
  operation.catch((error) => {
    console.error(
      JSON.stringify({
        backupVerified: false,
        error: error instanceof Error ? error.message : "Unknown backup error",
      }),
    );
    process.exitCode = 1;
  });
}

module.exports = { decryptArchive };

module.exports = {
  decode,
  decryptArchive,
  validateSnapshot,
};
