/**
 * Une clases condicionales y colapsa el espacio en blanco.
 *
 * Las clases de este proyecto se escriben en plantillas multilínea para
 * poder leerse; sin colapsar, ese formato llega al DOM como saltos de
 * línea dentro del atributo class.
 */
export function cn(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
