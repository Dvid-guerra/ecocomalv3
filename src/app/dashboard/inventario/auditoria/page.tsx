import AuditoriaInventario from "@/features/inventory/components/AuditoriaInventario";
import AccesoOperativo from "@/features/inventory/components/registro/AccesoOperativo";

export const metadata = { title: "Auditoría de inventario · Ecocomal" };

export default function AuditoriaPage() {
  return (
    <AccesoOperativo>
      <AuditoriaInventario />
    </AccesoOperativo>
  );
}
