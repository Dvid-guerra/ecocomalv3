export interface FelInput {
  nit: string;
  razonSocial: string;
  direccion: string;
  item: string;
  cantidad: number;
  precioUnitario: number;
}

function texto(value: unknown, campo: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${campo} es obligatorio.`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${campo} es obligatorio.`);
  if (normalized.length > maxLength) {
    throw new Error(`${campo} excede el máximo de ${maxLength} caracteres.`);
  }
  return normalized;
}

export function validarEntradaFel(value: unknown): FelInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("El cuerpo de la solicitud no es válido.");
  }

  const body = value as Record<string, unknown>;
  const cantidad = body.cantidad;
  const precioUnitario = body.precioUnitario;

  if (typeof cantidad !== "number" || !Number.isSafeInteger(cantidad) || cantidad <= 0 || cantidad > 100_000) {
    throw new Error("La cantidad debe ser un entero entre 1 y 100000.");
  }
  if (typeof precioUnitario !== "number" || !Number.isFinite(precioUnitario) || precioUnitario <= 0 || precioUnitario > 10_000_000) {
    throw new Error("El precio unitario no es válido.");
  }

  const precioCentavos = Math.round(precioUnitario * 100);
  if (Math.abs(precioUnitario * 100 - precioCentavos) > 1e-7) {
    throw new Error("El precio unitario admite como máximo dos decimales.");
  }

  return {
    nit: texto(body.nit, "El NIT", 20),
    razonSocial: texto(body.razonSocial, "La razón social", 200),
    direccion: texto(body.direccion, "La dirección", 300),
    item: texto(body.item, "El producto", 120),
    cantidad,
    precioUnitario: precioCentavos / 100,
  };
}

export function calcularImportesFel(cantidad: number, precioUnitario: number) {
  const totalCentavos = cantidad * Math.round(precioUnitario * 100);
  const subtotalCentavos = Math.round(totalCentavos / 1.12);
  const ivaCentavos = totalCentavos - subtotalCentavos;

  if (!Number.isSafeInteger(totalCentavos)) {
    throw new Error("El total de la factura excede el límite permitido.");
  }

  return {
    subtotal: subtotalCentavos / 100,
    iva: ivaCentavos / 100,
    total: totalCentavos / 100,
  };
}
