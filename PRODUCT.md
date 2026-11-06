# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sistema interno de un solo taller, con cuatro roles (`Gerente`, `Subgerente`, `Supervisor`, `Colaborador`). Las cuentas nacen inactivas desde `/registro` y un Gerente o Subgerente las activa.

- **Gerencia en oficina** (Gerente / Subgerente), en computadora de escritorio: finanzas, ventas, administración de personal y órdenes de compra.
- **Supervisor en planta**, en tablet o celular, moviéndose por el taller: producción, stock, movimientos de material.
- **Colaboradores de taller** (Herrería, Fundición, Carga, Labores Extras), en su propio celular dentro de planta: marcan jornada, consultan tareas y plan semanal, piden permisos. Entran por `/empleado/portal`, no por el dashboard.
- **Equipo de entregas en campo**, en comunidades rurales de Guatemala, frecuentemente con señal mala o nula.

## Product Purpose

Ecocomal v3 es el sistema de gestión interno del taller Ecocomal (Guatemala), que fabrica estufas ahorradoras de leña. Reúne en un solo lugar personal, planta y producción, inventario y compras, ventas, entregas y finanzas.

Éxito significa que la operación deje de depender de hojas de Excel y mensajes de WhatsApp. Hoy se usa solo en Ecocomal, pero se construye para poder instalarse después en otros talleres u ONG similares.

## Positioning

Una combinación que un ERP genérico no cubre: producción artesanal organizada por áreas de taller con recetas (BOM) por pieza, costo de mano de obra por unidad calculado sobre el salario diario guatemalteco, facturación con el IVA del Régimen General de Guatemala, y trazabilidad geográfica de estufas entregadas por comunidad y departamento para informes a donantes y proyectos ambientales.

## Operating Context

- **Módulos del dashboard**: hub por rol (`/dashboard`), Planta de Trabajo, Administración, Ventas y Envíos (con orden de envío), Mapa e Historial de entregas, Inventario y Compras (con recetas), Finanzas. El portal del colaborador vive aparte en `/empleado/portal`.
- **Áreas de planta**: Herrería, Fundición, Carga, Labores Extras.
- **Jornada**: 48 h semanales (8 h × 6 días, Lun–Sáb). Planilla quincenal con días trabajados, horas ordinarias, extra y déficit. Salario diario por defecto Q84 (salario mínimo de referencia).
- **Asistencia**: entrada y salida marcadas por el propio colaborador, con bitácora de texto y fotos.
- **Catálogo oficial de modelos**: Ecocina, EcoPlancha Superior, Ecoplancha Híbrida, Ecocomal.
- **Flujo de pedido**: Cotización → Confirmado → En Producción → Listo → Entregado. **Flujo de envío**: Pendiente → En Ruta → Entregado.
- **Compras**: proveedores con etiqueta de color; órdenes de compra en estado Pendiente o Recibida.
- Idioma de la operación: español de Guatemala. Moneda: quetzales (`Q`). Zona horaria: `America/Guatemala`.
- `DOCUMENTACION_COMPLETA.md` es la referencia técnica del proyecto, pero está parcialmente desactualizada: describe Next.js 15 y no cubre Ventas, Entregas, Inventario ni el asistente de IA.

## Capabilities and Constraints

- **Autenticación y acceso**: cookie de sesión HTTP-only creada y verificada por Firebase Admin, con doble capa — `src/proxy.ts` (proxy de Next.js 16, antes middleware) en el borde y un guard de cliente que valida el rol contra Firestore. La cookie nunca es la fuente de verdad del rol.
- **Datos**: Cloud Firestore con observadores `onSnapshot` en tiempo real. Los cambios de stock y el descuento de materiales al iniciar producción se ejecutan en transacciones con `increment()`. Los movimientos de inventario y las facturas son inmutables por reglas de Firestore (`update, delete: if false`).
- **Despliegue**: hPanel de Hostinger con build de webpack; Turbopack rompe el despliegue. Node `>= 22.12`; las dependencias se instalan con `--legacy-peer-deps`. Un cambio en cualquier variable `NEXT_PUBLIC_*` exige redesplegar.
- **Conexión intermitente**: el sistema debe tolerar mala señal en taller y en campo sin romperse ni perder datos. **Requisito confirmado, todavía no resuelto**: no existe capa offline ni cola de reintentos. Es una obligación de diseño, no una capacidad actual.
- **Asistente de inventario con IA** (Gemini vía AI SDK): es de **solo lectura**. Toda cifra que entregue debe venir de una herramienta; no estima ni inventa números, y si no hay datos lo dice.
- **Facturación**: el módulo de Finanzas calcula el desglose del IVA del 12 % (subtotal = total / 1.12) y guarda en la colección `facturas`. Pero `src/app/api/fel/route.ts` es una **simulación** — lleva un `TODO` explícito para sustituirla por el adaptador del certificador FEL. **No existe certificación FEL real ante la SAT.** Ninguna interfaz ni texto debe afirmar que una factura quedó certificada.
- **Terminología**: "modelo" es un producto del catálogo; "receta" o BOM son las piezas y sus insumos; "movimiento" es una entrada o una salida de inventario.

## Brand Commitments

- Nombre: **Ecocomal**. Voz en español de Guatemala, directa y breve.
- Identidad verde, declarada en tokens en `src/app/globals.css` (`--color-primary: #16a34a`).
- **Pendiente del usuario**: no hay logotipo ni marca gráfica en el repositorio. `public/` solo contiene los SVG de plantilla de Next.js y `guatemala-departments.json`.

## Evidence on Hand

- Datos operativos reales en el Firestore del proyecto (usuarios, stock, movimientos, pedidos, asistencias).
- `public/guatemala-departments.json`, base del mapa de entregas por departamento.
- Fuera del repositorio, en `Desktop/ECOCOMAL`: catálogo de estufas, fotos de planta, camión, almacenes y comunidades, boleta de evaluación de resultados con grupos focales, y Plan de Gestión Ambiental Categoría A.
- **No existen y no deben inventarse**: testimonios, casos de estudio, benchmarks, menciones de prensa, ni precios o licencias publicados.

## Product Principles

1. **Ningún número sin fuente.** Si una cifra no sale de los datos, no se muestra.
2. **El registro es inmutable.** Movimientos y facturas no se editan ni se borran; la trazabilidad para auditoría e informes vale más que la corrección cómoda.
3. **El taller va en el bolsillo.** Planta, portal del colaborador y entregas se diseñan primero para un celular, con una mano, y con mala conexión.
4. **El rol decide lo que se ve, y el rol vive en Firestore.** Nunca en la cookie, nunca solo en el cliente.
5. **Específico ahora, replicable después.** Nada se amarra a datos de un solo taller cuando evitarlo no cuesta.

## Accessibility & Inclusion

No se ha establecido un estándar formal (WCAG u otro) como requisito. Sí hay necesidades de usuario confirmadas por el escenario de uso: alfabetización digital variada entre el personal de taller, por lo que la interfaz usa español claro sin jerga en inglés y objetivos táctiles amplios; y uso en planta y a la intemperie, que exige contraste alto y legibilidad con pantalla a la luz del día.
