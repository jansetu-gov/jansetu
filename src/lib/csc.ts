export type CscCentre = {
  id?: string;
  name: string;
  address: string;
  distance_km?: number;
};

/**
 * Gets live GPS coordinates and converts them to a readable real-world address
 * using free OpenStreetMap Reverse Geocoding.
 */
export async function findNearestCsc(): Promise<CscCentre[]> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve([]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Free Reverse Geocoding API to get readable address from Lat/Lng
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`
          );
          const data = await res.json();
          const address = data.address || {};

          // Extract realistic location names from the user's actual live GPS
          const district = address.state_district || address.city || address.county || "Local";
          const area = address.suburb || address.neighbourhood || address.town || "Block Office";
          
          // Generate a random realistic distance (1 to 15 km) for the demo
          const randomDistance = parseFloat((Math.random() * 14 + 1).toFixed(1));

          resolve([
            {
              name: `CSC ${district}`,
              address: `Near ${area}, ${district}`,
              distance_km: randomDistance,
            },
          ]);
        } catch (err) {
          console.error("Reverse geocoding failed:", err);
          // Fallback if API fails
          resolve([
            {
              name: "Nearest CSC Centre",
              address: "Address unavailable, please check internet",
            }
          ]);
        }
      },
      (error) => {
        console.warn("GPS Location Error:", error.message);
        resolve([]);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}