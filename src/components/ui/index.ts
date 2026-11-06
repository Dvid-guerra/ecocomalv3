/**
 * Sistema de diseño UI — Ecocomal v3 · "Soft Corporate"
 *
 * Gris frío (slate) como voz del cromo; el verde de marca entra solo
 * como tono de estado. Los valores viven en `src/app/globals.css`;
 * aquí viven las piezas que los consumen.
 *
 * Si una pantalla necesita un botón, un campo, una tarjeta, una pestaña,
 * un badge o un estado vacío, sale de aquí. Un estilo inline nuevo es
 * una pieza que falta en este archivo, no una excepción.
 */

export { Button } from "./Button";

export { Card, CardHeader, CardBody, CardFooter } from "./Card";

export { KpiCard } from "./KpiCard";
export type { KpiCardProps } from "./KpiCard";

export { FormField, TextInput, SelectInput, TextArea } from "./FormField";

export { Badge } from "./Badge";
export type { Tono } from "./Badge";

export { Tabs } from "./Tabs";
export type { TabItem } from "./Tabs";

export { PageHeader } from "./PageHeader";

export { Spinner, EmptyState, Skeleton, Aviso } from "./Feedback";
