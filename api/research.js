const SUPABASE_URL = "https://sjkeerulozbifeevcboy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqa2VlcnVsb3piaWZlZXZjYm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjU5NTMsImV4cCI6MjA5ODM0MTk1M30.sbWyZYFaWzKMfr03PN9M-ZOJbNSLQUuVpoE4OwtmLks";

async function getCachedProfile(businessName) {
  const encoded = encodeURIComponent(`%${businessName.toLowerCase()}%`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=profile&query=ilike.${encoded}&limit=1`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0]?.profile || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Extract business name from the request to check cache
  const userMessage = req.body?.messages?.[0]?.content || "";
  const businessName = userMessage.replace("Research this business for insurance intake: ", "").trim();

  // Check Supabase cache first
  try {
    const cached = await getCachedProfile(businessName);
    if (cached) {
      console.log("Cache hit for:", businessName);
      return res.status(200).json({
        content: [{ type: "text", text: JSON.stringify(cached) }],
        cached: true,
      });
    }
  } catch (e) {
    console.error("Cache check failed", e);
  }

  // No cache hit — call Anthropic with Haiku
  const body = {
    ...req.body,
    model: "claude-haiku-4-5-20251001",
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.VITE_ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-search-2025-03-05",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  res.status(response.status).json(data);
}