/** Minúsculas y sin tildes, para que "lamina" encuentre "Lámina". */
export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
