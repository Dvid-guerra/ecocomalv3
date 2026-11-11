---
name: Ecocomal
description: Identidad Ecocomal aplicada al sistema de gestión del taller.
colors:
  brand: "#4d8c00"
  brand-dark: "#294b00"
  brand-soft: "#eff5e7"
  brand-accent: "#f98b1d"
  brand-accent-hover: "#efa02f"
  brand-yellow: "#f7d300"
  brand-earth: "#7f460d"
  canvas: "#f8f8f4"
  surface: "#ffffff"
  sunken: "#f0f1e9"
  line: "#e1e4d7"
  line-strong: "#c6cdbb"
  ink: "#242719"
  ink-body: "#353b2e"
  ink-muted: "#5e6956"
  ink-onDark: "#f8fafc"
  action: "#345d00"
  masthead: "#1b2915"
  ok: "#345d00"
  warn: "#7f460d"
  risk: "#b91c1c"
  info: "#1d4ed8"
typography:
  headline:
    fontFamily: "Oswald, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
rounded:
  control: "0.75rem"
  card: "1rem"
  panel: "1.5rem"
spacing:
  gap: "0.5rem"
  control-x: "1rem"
  card-x: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  button-primary-hover:
    backgroundColor: "{colors.brand-accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  chip:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.control}"
  navigation-selected:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
---

# Design System: Ecocomal

## Overview

La identidad real de Ecocomal acompaña una interfaz operativa existente: verde de marca, naranja de acción y superficies claras de matiz vegetal. La prioridad es leer datos y operar en oficina, planta y campo. Esta documentación registra la implementación; no establece una nueva composición de pantallas ni una metáfora creativa no aprobada.

La autoridad visual es `BRAND KIT ECOCOMAL.pdf`, páginas 4–5, proporcionado desde `C:/Users/david/Downloads/`. Los tokens implementados viven en `src/app/globals.css`; la carga tipográfica, en `src/app/layout.tsx`. Los PNG originales se copiaron con autorización desde el proyecto vecino `ecocomal-web/public` a `public/brand/ecocomal.png` y `public/brand/ecocomal-blanco.png`. `BrandLogo` conserva su proporción original de 1028 × 550.

**Key Characteristics:**

- Marca original reconocible y sin reconstrucciones.
- Lectura sobria, contraste alto y controles táctiles.
- Jerarquía de acción naranja y navegación verde profundo.
- Estados y etiquetas operativas conservan su significado.

## Colors

### Primary

El verde `brand` identifica Ecocomal. Los tonos `action` y `brand-dark` son derivados funcionales para texto, selección y contraste; `brand-soft` acompaña superficies de marca.

### Secondary

El naranja `brand-accent` identifica acciones principales y el remate de las cabeceras. Los botones llevan texto oscuro. El manual imprime HEX y RGB discordantes para el naranja; esta aplicación sigue el HEX de la página 4, no una conversión del RGB impreso.

### Tertiary

Amarillo `brand-yellow` y marrón `brand-earth` pertenecen a la paleta oficial. Su presencia en el sistema no obliga a utilizarlos en cada pantalla ni a asignarles estados de negocio.

### Neutral

`canvas` es el fondo; `surface`, tarjetas; `sunken`, campos y pistas de navegación. `ink`, `ink-body` e `ink-muted` separan títulos, lectura y contexto. `line` y `line-strong` delimitan sin competir. La cabecera usa el verde oscuro `masthead` y el logo blanco.

**The Semantic Color Rule.** Los colores de éxito, advertencia, riesgo e información conservan su significado. Las categorías y etiquetas físicas de inventario no se recolorean como decoración corporativa.

## Typography

Oswald aporta la silueta condensada a títulos principales; Inter mantiene legibles formularios, tablas, cifras y ayudas. Son sustitutos autorizados inspirados en el manual, no fuentes oficiales de Ecocomal. La página 5 muestra Press Gothic Regular / Futura Condensed Medium y menciona Parsi / Aguda en el texto; no se recibieron archivos tipográficos que permitan resolver esa discrepancia.

El estilo base de `h1` usa Oswald semibold; componentes como `PageHeader` pueden elevar el peso a bold. `PageHeader` pasa de 20 a 24 px desde el ancho pequeño de escritorio. Los títulos interiores de tarjeta usan Inter de 14 px y peso 600; las etiquetas, 12 px y peso 600. La escala de cuerpo depende de cada superficie y no tiene un tamaño global único. Las cifras operativas usan numerales tabulares mediante `nums`.

**The Reading Rule.** La fuente condensada sirve a títulos; el contenido operativo conserva Inter y etiquetas claras en español.

## Layout

Se conserva la estructura de navegación, formularios, tarjetas y módulos existente. Los controles comunes alcanzan 44 px de altura en móvil; a partir de 640 px, el botón mediano y los campos pueden compactarse a 36 px y el botón pequeño a 32 px. Las tarjetas usan 20 px laterales y 16 px verticales en su cuerpo. Las pistas de tabs permiten desplazamiento horizontal en celular.

El logo usa altura automática, sin estirar, recortar ni recrear sus trazos. El componente tiene ancho predeterminado de 112 px y declara recursos previstos de 104 px en móvil y 140 px en pantallas mayores; `sizes` no fija por sí solo el ancho visible. El manual no ha establecido aquí un mínimo digital verificable: mantener al menos 104 px en las cabeceras actuales es una referencia de implementación que debe verificarse visualmente, no una norma oficial de marca. Conservar el área libre incluida en el recurso y comprobar lectura en móvil.

## Elevation & Depth

La separación combina superficie blanca, anillo tenue y sombra suave. `shadow-card` es el reposo; `shadow-raised` se reserva para tarjetas interactivas al pasar el puntero; `shadow-overlay` distingue capas flotantes. Los valores exactos se conservan en el sidecar y en CSS. Las tarjetas informativas no adquieren movimiento de enlace.

La entrada `rise` dura 420 ms y desplaza 8 px; la carga de esqueleto pulsa cada 1.6 s. Las preferencias de movimiento reducido suprimen la continuidad de animaciones y transiciones. No añadir movimiento de marca que retrase tareas frecuentes.

## Shapes

Controles, tarjetas y paneles usan tres radios escalonados registrados en el frontmatter. Los anillos de un píxel y las superficies cálidas definen el contorno. El logo conserva la geometría del archivo, independiente de los radios de la interfaz.

## Components

### Buttons

La variante principal usa naranja, texto oscuro y sombra baja. La secundaria real de `Button` es blanca, con texto de cuerpo y anillo; no es un botón verde. Ghost utiliza texto atenuado y superficie hundida al pasar el puntero. Danger conserva el rojo semántico. Las transiciones duran 150 ms; el estado pulsado reduce la escala a 0.98. Carga y deshabilitado mantienen su comportamiento y anuncio accesible existentes.

### Inputs / Fields

Campos hundidos con anillo tenue y superficie blanca al enfocar. Error conserva superficie y borde de riesgo. El foco visible global usa contorno de 2 px, separado 2 px; sobre fondos oscuros se vuelve blanco. No sustituir etiquetas visibles por placeholders.

### Chips

Las insignias combinan texto de 12 px semibold, radio de control y relleno de 8 px horizontal / 2 px vertical. El tono neutral usa superficie hundida; los tonos semánticos nombran estados. La variante sólida usa verde de acción con texto blanco.

### Cards / Containers

Tarjetas blancas con anillo y sombra de reposo. La variante panel amplía el radio. Solo las tarjetas interactivas elevan su sombra y se desplazan 2 px al pasar el puntero. Los separadores ordenan cabecera, cuerpo y pie.

### Navigation

Cabecera verde oscura con logo blanco y remate naranja; las tabs seleccionadas usan verde de acción y texto blanco. Se conserva la navegación responsive existente y sus permisos. El logo de color sirve sobre superficies claras; el blanco sobre cabeceras oscuras.

## Do's and Don'ts

### Do:

- **Do** reutilizar los tokens de `globals.css` y los recursos originales de `public/brand`.
- **Do** conservar proporción del logo, foco visible y lectura de cifras en móvil.
- **Do** mantener estados, categorías y etiquetas físicas de inventario con su significado actual.
- **Do** describir Oswald e Inter como sustitutos autorizados.

### Don't:

- **Don't** reconstruir, deformar o recolorear los PNG del logo.
- **Don't** usar naranja o verde oficial con texto blanco sin verificar contraste.
- **Don't** extender la fuente condensada a tablas o formularios densos.
- **Don't** presentar decisiones digitales derivadas como normas impresas del manual.
