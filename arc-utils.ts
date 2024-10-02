/**
 * Helper function to convert binary point data into format expected by ArcLayer
 */
export function pointToArcDataTransform(data) {
  const { attributes, numericProps, properties } = data;
  const { getPosition } = attributes;

  const features: any[] = [];
  for (let i = 0; i < data.length; i++) {
    // For each point extract start position & properties
    const position = getPosition.value.subarray(
      getPosition.size * i,
      getPosition.size * (i + 1)
    );
    const ride_count = numericProps.ride_count.value[i];
    const start_station_id = numericProps.start_station_id.value[i];

    // Parse out destination positions from MULTIPOINT WKT string
    const { avg_durations, end_geom } = properties[i];
    const durations = avg_durations.split(',');
    const destinations = end_geom.slice(11, -1).split(', ');

    // Iterate over destinations, adding per-arc properties
    let j = 0;
    for (const destination of destinations) {
      const end = destination.split(' ').map((s) => parseFloat(s));
      const duration = parseFloat(durations[j++]);

      const geometry = [position, end];
      const properties = { duration, start_station_id };

      // Output one arc per start/end pair
      features.push({ geometry, properties });
    }
  }
  return features;
}
