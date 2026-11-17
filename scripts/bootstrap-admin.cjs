const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Define ${name} antes de crear al administrador.`);
  return value;
}

async function main() {
  const cedulaInput = requiredEnvironment("ADMIN_CEDULA")
    .toUpperCase()
    .replace(/[\s.-]/g, "");
  const cedula = /^\d{5,12}$/.test(cedulaInput)
    ? `V${cedulaInput}`
    : cedulaInput;
  const fullName = requiredEnvironment("ADMIN_NAME").replace(/\s+/g, " ");
  const rawPhone = requiredEnvironment("ADMIN_PHONE").replace(/[\s().-]/g, "");
  const nationalPhone =
    rawPhone.startsWith("+58")
      ? rawPhone.slice(3)
      : rawPhone.startsWith("58") && rawPhone.length === 12
        ? rawPhone.slice(2)
        : rawPhone.startsWith("0") && rawPhone.length === 11
          ? rawPhone.slice(1)
          : rawPhone.length === 10
            ? rawPhone
            : "";
  const phone = /^[24]\d{9}$/.test(nationalPhone)
    ? `+58${nationalPhone}`
    : "";
  const password = requiredEnvironment("ADMIN_PASSWORD");
  const secret = requiredEnvironment("AUTH_SECRET");

  if (!/^[VE]\d{5,12}$/.test(cedula)) {
    throw new Error("ADMIN_CEDULA debe ser una cédula venezolana válida.");
  }
  if (fullName.length < 3 || fullName.length > 100) {
    throw new Error("ADMIN_NAME debe tener entre 3 y 100 caracteres.");
  }
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("ADMIN_PHONE debe ser un teléfono venezolano, por ejemplo 0412 123 4567.");
  }
  if (password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("ADMIN_PASSWORD debe tener entre 10 y 72 bytes.");
  }
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_SECRET debe contener al menos 32 bytes aleatorios.");
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({
      where: { cedula },
      select: { id: true },
    });
    if (existing) {
      throw new Error(
        "Esa cédula ya tiene una cuenta. No se modificarán roles ni contraseñas existentes desde el bootstrap.",
      );
    }

    await prisma.user.create({
      data: {
        cedula,
        fullName,
        whatsappPhone: phone,
        passwordHash: await bcrypt.hash(password, 12),
        role: "ADMIN",
      },
    });
    console.log("Administrador inicial creado. Elimina las variables ADMIN_* del archivo .env.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("No se pudo crear el administrador inicial:", error);
  process.exitCode = 1;
});
