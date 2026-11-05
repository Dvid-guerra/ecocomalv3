// Tipado mínimo de `qrcode` (solo lo que usa la app), para no depender de @types/qrcode.
declare module "qrcode" {
  interface OpcionesQR {
    type?: "svg" | "terminal" | "utf8";
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  }
  export function toString(texto: string, opciones?: OpcionesQR): Promise<string>;
  const QRCode: { toString: typeof toString };
  export default QRCode;
}
