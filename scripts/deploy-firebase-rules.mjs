import { readFile } from "node:fs/promises";
import { applicationDefault, cert } from "firebase-admin/app";

const firebaseConfig = JSON.parse(
  await readFile(new URL("../.firebaserc", import.meta.url), "utf8"),
);
const projectId =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.FIREBASE_ADMIN_PROJECT_ID ??
  firebaseConfig.projects?.default;
if (!projectId) throw new Error("No se encontró el ID del proyecto Firebase.");

// Usa la cuenta de servicio de .env.local; si no está, cae a las credenciales de gcloud.
const { FIREBASE_ADMIN_CLIENT_EMAIL: clientEmail, FIREBASE_ADMIN_PRIVATE_KEY: rawKey } = process.env;
const credential = clientEmail && rawKey
  ? cert({ projectId, clientEmail, privateKey: rawKey.replace(/\\n/g, "\n") })
  : applicationDefault();

console.log(`Desplegando reglas en el proyecto: ${projectId}`);
const token = await credential.getAccessToken();
const baseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}`;

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function deployRules(fileName, releaseId) {
  const content = await readFile(new URL(`../${fileName}`, import.meta.url), "utf8");
  const ruleset = await api("/rulesets", {
    method: "POST",
    body: JSON.stringify({ source: { files: [{ name: fileName, content }] } }),
  });

  const releasePath = `/releases/${releaseId}`;
  const current = await fetch(`${baseUrl}${releasePath}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (current.status === 404) {
    await api("/releases", {
      method: "POST",
      body: JSON.stringify({
        name: `projects/${projectId}/releases/${releaseId}`,
        rulesetName: ruleset.name,
      }),
    });
  } else {
    if (!current.ok) throw new Error(`No se pudo consultar ${releaseId}: ${current.status}`);
    await api(releasePath, {
      method: "PATCH",
      body: JSON.stringify({
        release: {
          name: `projects/${projectId}/releases/${releaseId}`,
          rulesetName: ruleset.name,
        },
        updateMask: "rulesetName",
      }),
    });
  }

  console.log(`${fileName}: desplegado en ${releaseId}`);
}

await deployRules("firestore.rules", "cloud.firestore");
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
if (!storageBucket) throw new Error("Falta FIREBASE_STORAGE_BUCKET.");
await deployRules("storage.rules", `firebase.storage/${storageBucket}`);
