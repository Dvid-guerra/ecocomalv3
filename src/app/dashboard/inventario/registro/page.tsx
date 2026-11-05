import PuntoRegistro from "@/features/inventory/components/registro/PuntoRegistro";
import AccesoOperativo from "@/features/inventory/components/registro/AccesoOperativo";

export const metadata = { title: "Punto de registro · Ecocomal" };

/** Kiosko del furgón: quién → escanear gaveta → cantidad → confirmar. `?m=<id>` viene del QR. */
export default async function PuntoRegistroPage({ searchParams }: { searchParams: Promise<{ m?: string | string[] }> }) {
  const { m } = await searchParams;
  return (
    <AccesoOperativo>
      <PuntoRegistro materialInicial={typeof m === "string" && m ? m : null} />
    </AccesoOperativo>
  );
}
