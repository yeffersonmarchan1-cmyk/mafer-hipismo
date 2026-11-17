import Link from "next/link";
import { policyVersion } from "@/lib/policy-version";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 text-slate-200 sm:px-8">
      <Link className="text-sm text-emerald-300 hover:text-emerald-200" href="/">
        ← Volver a Cuadro Perfecto
      </Link>
      <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
        Borrador · requiere revisión legal local
      </p>
      <h1 className="mt-2 text-3xl font-bold text-white">
        Privacidad y tratamiento de datos
      </h1>
      <p className="mt-3 text-xs text-slate-500">Versión {policyVersion}</p>
      <div className="mt-7 space-y-6 text-sm leading-7 text-slate-300">
        <p>
          Esta página describe el tratamiento de datos de Cuadro Perfecto. Es
          un borrador operativo, no asesoría legal. La persona responsable debe
          completar los datos de contacto y hacer revisar el texto conforme a
          las normas aplicables en Venezuela antes de publicar o continuar
          recogiendo información.
        </p>
        <section>
          <h2 className="text-lg font-semibold text-white">Datos utilizados</h2>
          <p>
            La aplicación solicita cédula, nombre, teléfono, contraseña y datos
            de las jugadas, junto con la fecha y versión de las reglas y políticas
            aceptadas y la confirmación declarada de mayoría de edad. Si se envía
            un pago, también puede registrar su
            referencia, teléfono de origen e imagen del comprobante. Los
            administradores pueden registrar motivos de revisión y ajustes
            contables. Las contraseñas se guardan como hashes bcrypt, no en
            texto legible.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">
            Finalidad y acceso
          </h2>
          <p>
            Los datos se usan para crear y proteger cuentas, recibir y
            verificar jugadas y pagos, administrar jornadas, liquidar resultados,
            prevenir abuso y mantener registros operativos y contables. Los
            comprobantes se guardan en un bucket privado de Supabase; la
            aplicación limita su visualización al titular del ticket y a
            administradores autorizados. El proveedor de hosting y Supabase
            procesan datos para prestar el servicio.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">
            Conservación, seguridad y solicitudes
          </h2>
          <p>
            Los registros de tickets, pagos aprobados, liquidaciones y auditoría
            pueden conservarse para mantener el historial contable. Los
            respaldos operativos se cifran y deben custodiarse por separado.
            No se debe almacenar información bancaria que no sea necesaria. Para
            consultar, corregir o solicitar la eliminación de datos, contacta al
            administrador por el canal oficial que este publique; algunas
            solicitudes pueden estar limitadas por obligaciones contables o por
            la integridad del historial.
          </p>
        </section>
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-xs text-amber-100">
          Antes de usar esta política en producción, publica la identidad y el
          contacto del responsable, los plazos de conservación, el proceso de
          atención de solicitudes y cualquier transferencia internacional
          aplicable, con revisión de un profesional local.
        </p>
      </div>
    </main>
  );
}
