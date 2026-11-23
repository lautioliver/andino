import type { NextRequest } from "next/server";
import { responderPasos } from "@/features/satelites/ruta";
import { pasosStarlink } from "@/features/satelites/starlink";

export const maxDuration = 30;

export function GET(request: NextRequest) {
  return responderPasos(request, pasosStarlink, "starlink");
}
