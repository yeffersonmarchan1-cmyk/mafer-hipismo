import Link from "next/link";
import { policyVersion } from "@/lib/policy-version";

export default function RulesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 text-slate-200 sm:px-8">
      <Link className="text-sm text-emerald-300 hover:text-emerald-200" href="/">
        ← Volver a Cuadro Perfecto
      </Link>
      <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
        Borrador · requiere revisión legal local
      </p>
      <h1 className="mt-2 text-3xl font-bold text-white">
        Reglas de uso y juego responsable
      </h1>
      <p className="mt-3 text-xs text-slate-500">Versión {policyVersion}</p>
      <div className="mt-7 space-y-6 text-sm leading-7 text-slate-300">
        <p>
          Este resumen operativo no es asesoría legal. El operador debe
          confirmar la legalidad, licencias, edad mínima, impuestos y reglas de
          premios aplicables antes de habilitar apuestas con dinero real. La
          aplicación exige que quien crea una cuenta confirme tener al menos
          18 años; esto es una declaración y la edad no se verifica con
          documentos. El operador debe validar este umbral con asesoría local.
        </p>
        <section>
          <h2 className="text-lg font-semibold text-white">Cuenta y jugadas</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Cada persona debe usar sus propios datos y proteger sus
              credenciales. No compartas tu contraseña ni el comprobante.
            </li>
            <li>
              La jugada se considera recibida cuando la aplicación confirma el
              envío. El pago queda pendiente hasta que administración valide el
              ticket y el comprobante.
            </li>
            <li>
              El precio y el total se muestran en bolívares antes del envío.
              Revisa las selecciones, la jornada y los datos de pago antes de
              confirmar.
            </li>
            <li>
              Un ticket puede editarse mientras la jornada esté abierta, sujeto
              al mismo número total de ejemplares y a no superar el monto
              originalmente pagado. Al cerrar la jornada, no se permiten
              cambios.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">
            Aprobación y liquidación
          </h2>
          <p>
            Solo los tickets aprobados participan en el pozo. La liquidación
            aplica la comisión logística del 10% al pozo de la jornada,
            incluido cualquier acumulado anterior. El saldo disponible se
            distribuye entre los cuadros ganadores; si no hay ganadores o
            quedan centavos indivisibles, el saldo correspondiente se acumula
            para otra jornada del mismo hipódromo. Los montos finales y
            resultados oficiales se publican en la aplicación.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">
            Juego responsable
          </h2>
          <p>
            Juega únicamente con dinero que puedas permitirte perder. No
            persigas pérdidas ni uses dinero destinado a gastos esenciales.
            Participar no garantiza premios. Si el juego deja de ser recreativo
            o afecta tu bienestar, detente y busca apoyo de una persona de
            confianza o de servicios locales.
          </p>
        </section>
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-xs text-amber-100">
          Completa las reglas comerciales y legales definitivas, la edad mínima
          y los canales de reclamos con revisión profesional antes de operar.
        </p>
      </div>
    </main>
  );
}
