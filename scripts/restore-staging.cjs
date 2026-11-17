const path = require("node:path");
const { Prisma, PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
const { decryptArchive } = require("./backup.cjs");

const migrationTable = "_prisma_migrations";
const insertionOrder = [
  "SystemConfig",
  "User",
  "Player",
  "RaceDay",
  "LoginRateLimit",
  "PasswordResetToken",
  "RaceDayHorse",
  "Ticket",
  "Bet",
  "TicketSelection",
  "PaymentProof",
  "BetSelection",
  "Payment",
  "HorseReplacement",
  "WinningSelection",
  "Settlement",
  "TicketPayout",
  "Payout",
  "OperationalAlert",
  "FinancialLedgerEntry",
];

function assertEnvironment(backup) {
  const required = [
    "BACKUP_ENCRYPTION_KEY",
    "STAGING_DATABASE_URL",
    "STAGING_SUPABASE_URL",
    "STAGING_SUPABASE_SERVICE_ROLE_KEY",
    "STAGING_ADMIN_PASSWORD",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Faltan variables locales seguras: ${missing.join(", ")}.`);
  }
  const targetDatabaseUrl = process.env.STAGING_DATABASE_URL.trim();
  const targetDatabase = new URL(targetDatabaseUrl);
  const targetStorage = new URL(process.env.STAGING_SUPABASE_URL.trim());
  const targetProjectRef = targetStorage.hostname.split(".")[0];
  if (
    targetStorage.protocol !== "https:" ||
    !targetStorage.hostname.endsWith(".supabase.co") ||
    targetStorage.hostname.split(".").length !== 3 ||
    !["postgres:", "postgresql:"].includes(targetDatabase.protocol) ||
    !(
      targetDatabase.hostname === `db.${targetProjectRef}.supabase.co` ||
      (targetDatabase.hostname.endsWith(".pooler.supabase.com") &&
        decodeURIComponent(targetDatabase.username)
          .split(".")
          .includes(targetProjectRef))
    ) ||
    targetProjectRef === backup.database.projectRef
  ) {
    throw new Error(
      "El destino no parece un proyecto Supabase de staging separado del respaldo.",
    );
  }
  if (process.env.STAGING_ADMIN_PASSWORD.trim().length < 16) {
    throw new Error("STAGING_ADMIN_PASSWORD debe tener al menos 16 caracteres.");
  }
  if (!(backup.database.tables.User || []).some((user) => user.role === "ADMIN")) {
    throw new Error("El respaldo no contiene una cuenta ADMIN para staging.");
  }
  return { targetProjectRef, targetStorage, targetDatabaseUrl };
}

function sanitizeRow(table, row, userIndex) {
  if (table === "User") {
    return {
      ...row,
      cedula: `TST${String(userIndex).padStart(10, "0")}`,
      fullName: row.role === "ADMIN" ? "Administrador de pruebas" : `Jugador de prueba ${userIndex}`,
      whatsappPhone: "04120000000",
      isActive: row.role === "ADMIN" && userIndex === 1,
      authVersion: row.authVersion + 1,
    };
  }
  if (table === "Player") {
    return {
      ...row,
      name: "Jugador de prueba",
      phone: null,
      notes: null,
    };
  }
  if (table === "PaymentProof") {
    return {
      ...row,
      storageBucket: null,
      storageKey: null,
      contentType: null,
      fileSizeBytes: null,
      paymentReference: null,
      sourcePhone: "04120000000",
    };
  }
  if (table === "Payment") {
    return {
      ...row,
      reference: `STAGING-${row.id}`,
      notes: null,
    };
  }
  if (table === "Ticket" && row.rejectionReason) {
    return { ...row, rejectionReason: "Motivo anonimizado para staging" };
  }
  if (table === "SystemConfig") {
    return {
      ...row,
      paymentBank: "STAGING ONLY",
      paymentCedula: "V000000000",
      paymentPhone: "04120000000",
      infoMessage: "Ambiente de pruebas: no se realizan pagos reales.",
    };
  }
  if (table === "FinancialLedgerEntry") {
    return {
      ...row,
      actorName: row.actorName ? "Administrador de pruebas" : null,
      ...(row.type === "ADJUSTMENT"
        ? { description: "Ajuste administrativo anonimizado" }
        : {}),
    };
  }
  return row;
}

function safeIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error("El respaldo contiene un identificador de esquema inválido.");
  }
  return `"${identifier}"`;
}

async function restoreStaging(backupPath) {
  if (!backupPath) throw new Error("Indica la ruta del respaldo cifrado.");
  const backup = await decryptArchive(path.resolve(backupPath));
  const { targetProjectRef, targetStorage, targetDatabaseUrl } =
    assertEnvironment(backup);
  const target = new PrismaClient({
    datasources: { db: { url: targetDatabaseUrl } },
  });
  const storage = createClient(
    targetStorage.origin,
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY.trim(),
    { auth: { persistSession: false } },
  );

  try {
    const tableRows = await target.$queryRawUnsafe(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const targetTables = tableRows.map((row) => row.tablename).sort();
    const sourceTables = Object.keys(backup.database.tableCounts).sort();
    const applicationTables = new Set(
      Prisma.dmmf.datamodel.models.map((model) => model.dbName || model.name),
    );
    const missingTables = [...applicationTables].filter(
      (table) => !targetTables.includes(table),
    );
    const unsupportedTables = sourceTables.filter(
      (table) =>
        table !== migrationTable &&
        (!applicationTables.has(table) || !insertionOrder.includes(table)),
    );
    if (missingTables.length || unsupportedTables.length) {
      throw new Error(
        "El esquema no es compatible con el respaldo o contiene tablas aún no soportadas.",
      );
    }

    const { data: bucket, error: bucketError } =
      await storage.storage.getBucket("payment-proofs");
    if (bucketError) {
      throw new Error(
        "No se pudo verificar el bucket privado de comprobantes de staging.",
      );
    }
    if (bucket.public) {
      throw new Error("El bucket de comprobantes de staging debe ser privado.");
    }
    const { data: root, error: listError } = await storage.storage
      .from("payment-proofs")
      .list("", { limit: 1 });
    if (listError || root?.length) {
      throw new Error("El bucket de staging debe estar vacío antes de restaurar.");
    }

    await target.$transaction(
      async (transaction) => {
        for (const table of applicationTables) {
          const count = await transaction.$queryRawUnsafe(
            `SELECT count(*)::text AS count FROM public.${safeIdentifier(table)}`,
          );
          if (Number(count[0].count) !== 0) {
            throw new Error(
              "Staging debe estar vacío antes de restaurar; no se modificó.",
            );
          }
        }

        const users = backup.database.tables.User || [];
        const adminIndex = Math.max(
          users.findIndex((user) => user.role === "ADMIN"),
          0,
        );
        const testPasswordHash = await bcrypt.hash(
          process.env.STAGING_ADMIN_PASSWORD,
          12,
        );
        const insertedCounts = {};

        for (const table of insertionOrder) {
          if (!backup.database.tables[table]) continue;
          const rows = backup.database.tables[table];
          let count = 0;
          for (const [index, rawRow] of rows.entries()) {
            let row = sanitizeRow(table, rawRow, index + 1);
            row = structuredClone(row);
            if (table === "User") {
              row.passwordHash = testPasswordHash;
              row.isActive = index === adminIndex && row.role === "ADMIN";
            }
            if (table === "LoginRateLimit" || table === "PasswordResetToken") {
              continue;
            }
            if (table === "RaceDay") row.rolloverFromId = null;
            const columns = Object.keys(row);
            if (!columns.length) continue;
            const placeholders = columns.map((_, column) => `$${column + 1}`);
            const sql = `INSERT INTO public.${safeIdentifier(table)} (${columns
              .map(safeIdentifier)
              .join(", ")}) VALUES (${placeholders.join(", ")})`;
            await transaction.$executeRawUnsafe(
              sql,
              ...columns.map((column) => decodeColumn(row[column])),
            );
            count += 1;
          }
          insertedCounts[table] = count;
        }

        for (const row of backup.database.tables.RaceDay || []) {
          if (!row.rolloverFromId) continue;
          await transaction.$executeRawUnsafe(
            'UPDATE public."RaceDay" SET "rolloverFromId" = $1 WHERE "id" = $2',
            row.rolloverFromId,
            row.id,
          );
        }

        for (const table of insertionOrder) {
          if (!backup.database.tables[table]) continue;
          const actual = await transaction.$queryRawUnsafe(
            `SELECT count(*)::text AS count FROM public.${safeIdentifier(table)}`,
          );
          if (Number(actual[0].count) !== (insertedCounts[table] || 0)) {
            throw new Error(`La verificación de restauración falló en ${table}.`);
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 },
    );

    console.log(
      JSON.stringify({
        stagingRestoreCompleted: true,
        stagingProjectRef: targetProjectRef,
        anonymizedAccounts: backup.database.tableCounts.User || 0,
        restoredTables: insertionOrder.filter(
          (table) => backup.database.tables[table],
        ).length,
        paymentProofImagesRestored: false,
        note: "Las cuentas y referencias de pago están anonimizadas; los comprobantes privados no se copian.",
      }),
    );
  } catch (error) {
    throw error;
  } finally {
    await target.$disconnect();
  }
}

function decodeColumn(value) {
  if (value && typeof value === "object" && "$type" in value) {
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
        throw new Error("Tipo de columna no reconocido en el respaldo.");
    }
  }
  return value;
}

if (require.main === module) {
  restoreStaging(process.argv[2]).catch((error) => {
    console.error(
      JSON.stringify({
        stagingRestoreCompleted: false,
        error: error instanceof Error ? error.message : "Unknown restore error",
      }),
    );
    process.exitCode = 1;
  });
}
