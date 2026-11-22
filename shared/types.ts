// Contratos compartidos entre Pacha y Cielo (ver docs/design.md, anexo de implementación).
// Cambios acá se revisan con cuidado: los usan la ficha, Cielo y los módulos de la noche.

export type PlaceId = "volcan" | "tumbaya" | "purmamarca" | "hornillos" | "maimara" | "elbayeh" | "tilcara"; // paradas del Tren Solar

export interface AndinoPlace {
  id: PlaceId;
  name: string;
  latitude: number;
  longitude: number;
  sourceUrls: string[];
}

export interface ExplorationContext {
  placeId: PlaceId;
  datetimeISO: string; // ISO-8601 con zona/offset explícito
}

export interface SkyQuery {
  placeId: PlaceId;
  datetimeISO: string;
}

export interface SkyObject {
  id: string;
  name: string;
  altitudeDeg: number;
  azimuthDeg: number;
  isAboveHorizon: boolean;
}

export interface PachaResult {
  candidatePlaceId: PlaceId | null;
  confidenceLabel: "alta" | "media" | "insuficiente"; // clasificación operativa, no probabilidad
  summary: string;
  sourceUrls: string[]; // solo URLs presentes en el dataset
  followUpSuggestions: string[];
  demoMode: boolean;
}
