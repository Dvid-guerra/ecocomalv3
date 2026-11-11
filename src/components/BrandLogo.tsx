import Image from "next/image";

/** Recursos originales de la marca; se conserva la proporción y el área libre. */
export function BrandLogo({
  inverso = false,
  className = "w-28",
}: {
  inverso?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={inverso ? "/brand/ecocomal-blanco.png" : "/brand/ecocomal.png"}
      alt="Ecocomal"
      width={1028}
      height={550}
      loading="eager"
      sizes="(max-width: 640px) 104px, 140px"
      className={`h-auto shrink-0 object-contain ${className}`}
    />
  );
}
