export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Missing query" });

  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${process.env.GOOGLE_PLACES_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return res.status(200).json({ found: false });
    }

    const placeId = data.candidates[0].place_id;
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,business_status&key=${process.env.GOOGLE_PLACES_KEY}`;
    const detailsRes = await fetch(detailsUrl);
    const details = await detailsRes.json();

    res.status(200).json({ found: true, result: details.result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}