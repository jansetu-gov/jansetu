/**
 * src/lib/csc.ts
 * -----------------------------------------------------------------
 * Finds the nearest CSC (Common Service Centre) to the user, using
 * GPS first and falling back to district-based lookup if location
 * isn't available.
 *
 * Requires: expo-location (already installed)
 * -----------------------------------------------------------------
 */
import * as Location from "expo-location";
import { supabase } from "@/client/supabase";

export type CscCenter = {
  id: string;
  name: string;
  address: string;
  district: string;
  state: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  distance_km?: number;
};

/**
 * Requests GPS permission and returns the device's current coordinates.
 * Returns null if permission is denied or location can't be read —
 * callers should fall back to district-based lookup in that case.
 */
export async function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (err) {
    console.warn("getCurrentCoords failed:", err);
    return null;
  }
}

/**
 * Returns the nearest CSC centres to a lat/lng, sorted by distance.
 */
export async function getNearestCscByCoords(
  lat: number,
  lng: number,
  limit = 3
): Promise<CscCenter[]> {
  const { data, error } = await supabase.rpc("nearest_csc", {
    in_lat: lat,
    in_lng: lng,
    max_results: limit,
  });
  if (error) {
    console.warn("getNearestCscByCoords failed:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Fallback when GPS is unavailable/denied: match by district instead.
 * No distance is returned since we don't have coordinates to compare.
 */
export async function getCscByDistrict(district: string, limit = 3): Promise<CscCenter[]> {
  const { data, error } = await supabase.rpc("csc_by_district", {
    in_district: district,
    max_results: limit,
  });
  if (error) {
    console.warn("getCscByDistrict failed:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * One call that does the right thing: try GPS first, fall back to a
 * known district if location isn't available. This is what the
 * apply-flow / SMS generation and the "Find Nearest CSC" button call.
 */
export async function findNearestCsc(fallbackDistrict?: string, limit = 3): Promise<CscCenter[]> {
  const coords = await getCurrentCoords();
  if (coords) {
    const byGps = await getNearestCscByCoords(coords.lat, coords.lng, limit);
    if (byGps.length) return byGps;
  }
  if (fallbackDistrict) {
    return getCscByDistrict(fallbackDistrict, limit);
  }
  return [];
}
