# MAFER Hipismo

Plataforma mobile-first para jugar al **Cuadro Perfecto** de La Rinconada. Utiliza Next.js
App Router, TypeScript, Tailwind CSS, Prisma y PostgreSQL (Supabase). Electron
continúa disponible para generar el instalador Windows de escritorio.

## Módulos

- **Jugador (`USER`)**: jugar al Cuadro Perfecto, consultar mis tickets y la pizarra oficial.
- **Administrador (`ADMIN`)**: jornadas e inscritos, validación de pagos,
  resultados/liquidación, configuración y usuarios.
- Los datos del jugador y los tickets se leen en el servidor con el ID de la
  sesión autenticada. La pizarra sólo publica tickets aprobados después del
  cierre de la jornada.
- `proxy.ts` ofrece redirecciones tempranas. Los layouts y las mutaciones
  comprueban además la sesión vigente y el rol en PostgreSQL.

## Configuración

Requisitos: Node.js 20.9+, npm y una base PostgreSQL accesible (por ejemplo,
Supabase).

1. Copia `.env.example` a `.env` y define `DATABASE_URL` con la cadena de
   conexión PostgreSQL/Supabase y `AUTH_SECRET` con al menos 32 bytes aleatorios.
   Para los comprobantes configura además `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` en el servidor; nunca expongas la clave service
   role en el navegador. La aplicación crea y verifica el bucket privado
   `payment-proofs` al recibir la primera imagen. Configura también `CRON_SECRET`
   para ejecutar el cierre de apuestas programado.
   En PowerShell puedes generar un secreto con:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

2. Instala y crea el esquema:

   ```powershell
   npm install
   npm run db:deploy
   ```

   Para cambios de esquema durante desarrollo, usa
   `npm run db:migrate -- --name nombre_del_cambio`.
3. Configura una sola vez `ADMIN_CEDULA`, `ADMIN_NAME`, `ADMIN_PHONE` y
   `ADMIN_PASSWORD` en `.env`; después crea al administrador inicial:

   ```powershell
   npm run db:bootstrap-admin
   ```

   El comando no cambia cuentas que ya existan. Elimina las variables
   `ADMIN_*` de `.env` al terminar. Las altas desde `/register` siempre crean
   cuentas `USER`.
4. Inicia el sitio en desarrollo con `npm run dev`. Abre
   `http://localhost:3000`.

En despliegue web, configura todas esas variables en el proveedor de hosting;
no las incluyas en el cliente ni en Git. La aplicación acepta comprobantes JPG,
PNG o WebP de hasta 5 MB y genera enlaces firmados de dos minutos solo después
de verificar que quien los solicita es su propietario o un administrador.
Los teléfonos de jugadores, Pago Móvil y administrador aceptan formato local
venezolano, por ejemplo `0412 123 4567`, sin exigir el prefijo `+58`; se guardan
normalizados internamente.
Cada jugada debe incluir una imagen del comprobante, una referencia de pago o
ambas. Para subir o consultar imágenes se necesitan `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`; los dos valores solo se usan en el servidor.
Configura un cron del proveedor para llamar cada minuto a
`GET /api/cron/close-race-days` con `Authorization: Bearer $CRON_SECRET`.
Las páginas de juego y pizarra también ejecutan el cierre vencido cuando se
visitan, pero el cron permite cerrar la jornada aunque no haya usuarios activos.

## Autenticación

- La cédula se normaliza y es única; la contraseña se almacena con bcrypt
  (factor 12).
- Las sesiones son JWT firmados con HS256 en cookies `HttpOnly`, `SameSite=Strict`
  y `Secure` en producción, con expiración de siete días.
- Cinco intentos fallidos bloquean temporalmente los nuevos intentos de esa
  cédula. La cuenta, el rol y la versión de sesión se vuelven a verificar en
  PostgreSQL en las rutas protegidas.
- El proxy de Next.js no sustituye a la autorización del servidor: cada layout
  administrativo y cada Server Action administrativa valida `ADMIN`.

## Inscritos

El módulo `/admin/jornadas` permite importar PDFs con texto seleccionable,
texto pegado y enlaces HTTPS de dominios autorizados en `IMPORT_ALLOWED_HOSTS`.
Se conserva el orden original de la lista de Gaceta en cada válida. Los PDF
escaneados necesitan OCR, que todavía no está incluido. Al importar configura
la hora de la primera válida en hora de Caracas; el sistema programa el cierre
30 minutos antes y conserva el botón de cierre manual.

Si no tienes el programa oficial, `/admin/jornadas` también permite crear una
jornada vacía indicando fecha y hora de la primera válida. En **Administrar
carreras** selecciona una de las seis válidas y agrega ejemplares de uno en
uno o pega una lista con formatos como `1. Pecadora`, `1 - Pecadora` o
`1 Pecadora`, uno por línea. Los números repetidos en una misma lista se
rechazan; los números ya existentes actualizan el nombre sin reactivar un
ejemplar retirado. Se pueden editar gualdrapa y nombre, retirar/reactivar,
eliminar individualmente o limpiar la válida completa.

Para preservar el historial, eliminar o limpiar se bloquea si los ejemplares
están referenciados por tickets o registros de sustitución; en ese caso se
pueden marcar como retirados. La lista se guarda en PostgreSQL y el selector
del jugador muestra gualdrapa y nombre de todos los ejemplares activos.

## Operación de jornadas

- Los jugadores seleccionan ejemplares activos de las seis válidas. El servidor
  vuelve a validar cada selección y calcula el importe fijo de **Bs. 5 por
  combinación**. Guarda el pago reportado y crea el ticket pendiente; la imagen
  privada es opcional si el jugador proporciona una referencia.
- Todos los tickets, acumulados, arrastres, comisiones y premios se guardan y
  muestran en bolívares (Bs.), con formato local, por ejemplo `Bs. 1.500,00`.
- Aprobar un pago lo incluye en el pozo; rechazarlo no lo suma. Retirar un
  ejemplar reemplaza las selecciones existentes por el siguiente ejemplar activo
  en el orden de Gaceta, con vuelta al inicio y registro de auditoría.
- Al cerrar la jornada, la pizarra expone públicamente solo tickets aprobados.
  La liquidación considera exclusivamente seis aciertos, descuenta 10% y
  distribuye 90% en partes iguales por ticket ganador. Sin ganadores, el 100%
  del pozo se traslada a la siguiente jornada. El reporte se puede imprimir o
  guardar como PDF desde el navegador.
- La jornada sigue las fases `Abierta` → `Cerrada / En curso` → `Finalizada`.
  Al cerrarse, la pizarra muestra tickets aprobados y acumulado; al liquidarse,
  muestra la combinación ganadora y los pagos. Las inscripciones pueden
  corregirse mientras esté abierta o en curso; después de liquidarla quedan
  bloqueadas para proteger los resultados y el historial de apuestas.
- En `/admin/users` se pueden activar/desactivar cuentas y restablecer
  contraseñas; ambas operaciones invalidan las sesiones anteriores y el sistema
  impide desactivar la última cuenta `ADMIN` activa.

Al desplegar cambios de esquema, ejecuta `npm run db:deploy` antes de activar la
nueva versión de la aplicación. La migración de bolívares conserva el importe
VES ya guardado por ticket, convierte los arrastres anteriores usando la tasa
configurada en ese momento y recalcula pozos y premios liquidados a partir de
esos importes. Verifica una copia de seguridad antes de aplicar migraciones a
una base de datos de producción.

## Escritorio Windows

El instalador sigue disponible mediante:

```powershell
npm run build:desktop
```

El `.exe` se genera en `release`. La aplicación de escritorio lee
`DATABASE_URL` y `AUTH_SECRET` del entorno del usuario de Windows y necesita
internet para conectarse a PostgreSQL.

## Instalar en teléfonos

La aplicación incluye un manifiesto PWA y sus iconos de instalación. Al
publicarla en un dominio HTTPS, el navegador compatible ofrece instalar
**MAFER Hipismo** desde el botón **Instalar app** de la portada o del panel. En
iPhone/iPad se muestran las instrucciones para Safari: **Compartir → Agregar a
pantalla de inicio**. La PWA usa modo de ventana independiente; sigue siendo una
aplicación en línea y necesita internet para autenticación, jornadas y jugadas.
