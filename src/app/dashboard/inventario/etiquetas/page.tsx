import EtiquetasQR from "@/features/inventory/components/EtiquetasQR";
import AccesoOperativo from "@/features/inventory/components/registro/AccesoOperativo";

export const metadata = { title: "Etiquetas QR · Ecocomal" };

export default function EtiquetasPage() {
  return (
    <AccesoOperativo>
      <EtiquetasQR />
    </AccesoOperativo>
  );
}
