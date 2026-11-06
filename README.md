# Ecocomal v3

Sistema interno para gestión de personal, planta, inventario, ventas, entregas y finanzas.

## Desarrollo local

1. Copia `.env.example` como `.env.local` y completa Firebase Web SDK y Firebase Admin.
2. Instala dependencias con `npm install --legacy-peer-deps`.
3. Inicia el servidor con `npm run dev`.

Firebase Admin acepta credenciales explícitas mediante las variables `FIREBASE_ADMIN_*` o Application Default Credentials en entornos administrados.

## Seguridad de Firebase

Las reglas versionadas están en `firestore.rules` y `storage.rules`. Revísalas contra un proyecto de pruebas antes de desplegarlas:

```bash
firebase emulators:start
firebase deploy --only firestore:rules,storage
```

Si Firebase CLI no está disponible, el proyecto incluye un despliegue equivalente mediante la API oficial:

```bash
npm run deploy:rules
```

Las cuentas creadas desde `/registro` nacen inactivas. Un gerente o subgerente debe activarlas desde Administración. La sesión web se almacena en una cookie HTTP-only creada y verificada por Firebase Admin.

## Validación

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Los cambios de stock de planta y el descuento de materiales al iniciar producción se ejecutan mediante transacciones de Firestore.

## Origen público en producción (Hostinger)

En Hostinger configura APP_ORIGIN=https://gestion.ecocomal.com (dominio público confirmado).
Para otras instalaciones usa el origen HTTPS exacto del sitio
(esquema y dominio, más puerto solo si no es el estándar), sin rutas, consultas,
credenciales ni comodines. Usa el dominio real mostrado en el navegador, no la
dirección interna de Node. Después aplica la configuración y redespliega/reinicia
la aplicación. El build usa webpack automáticamente con npm run build.

Sin APP_ORIGIN válida en producción, las API protegidas responden 503 con un
mensaje de configuración y no ejecutan la operación. El build puede terminar
sin esta variable: la validación se realiza al recibir solicitudes.

Se rechazan solicitudes con Origin ausente, null o externo y las marcadas
Sec-Fetch-Site: cross-site. Los clientes externos sin Origin requieren un flujo
de autenticación independiente; no se debe quitar esta protección. No se confía
en Host ni en X-Forwarded-* para autorizar orígenes. Las sesiones y los roles
se siguen validando por separado. Si cambia el dominio, actualiza APP_ORIGIN.

En desarrollo sin APP_ORIGIN se compara contra el origen de la URL local.
Para ejecutar una compilación de producción local, configura explícitamente un
origen HTTPS y sirve la aplicación detrás de HTTPS.
