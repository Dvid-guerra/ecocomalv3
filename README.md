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
