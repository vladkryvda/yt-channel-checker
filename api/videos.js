// Vercel Serverless Function.
// Path in project: /api/videos.js  →  deployed at /api/videos
// Set YOUTUBE_API_KEY in: Vercel dashboard → Project → Settings → Environment Variables
// For local dev: create a .env.local file with YOUTUBE_API_KEY=... and add
// .env.local to .gitignore so it never gets committed. Run with `vercel dev`.

export default async function handler(req, res) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: "YOUTUBE_API_KEY is not configured on the server" });

  const raw = (req.query.channel || "").toString().trim();
  if (!raw) return res.status(400).json({ error: "missing ?channel= param" });

  try {
    const parsed = parseInput(raw);

    const channelUrl =
      parsed.type === "handle"
        ? `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(parsed.value)}&key=${key}`
        : `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(parsed.value)}&key=${key}`;

    const channelRes = await fetch(channelUrl);
    const channelData = await channelRes.json();
    if (channelData.error) throw new Error(channelData.error.message);
    if (!channelData.items?.length) throw new Error("channel not found");

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=6&key=${key}`;
    const playlistRes = await fetch(playlistUrl);
    const playlistData = await playlistRes.json();
    if (playlistData.error) throw new Error(playlistData.error.message);

    const videos = (playlistData.items || []).map((item) => {
      const videoId = item.snippet.resourceId.videoId;
      return {
        id: videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        date: formatDate(item.snippet.publishedAt),
      };
    });

    res.status(200).json({ videos });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

function parseInput(input) {
  let clean = input.trim();
  try {
    if (clean.includes("google.com")) {
      const u = new URL(clean);
      clean = u.searchParams.get("url") || u.searchParams.get("q") || clean;
    }
  } catch (_) {}

  const idMatch = clean.match(/(UC[a-zA-Z0-9_-]{22})/);
  if (idMatch) return { type: "id", value: idMatch[1] };

  const handleMatch = clean.match(/(@[a-zA-Z0-9._-]+)/);
  if (handleMatch) return { type: "handle", value: handleMatch[1] };

  if (clean.startsWith("http")) {
    const parts = clean.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return { type: "handle", value: last.startsWith("@") ? last : `@${last}` };
  }

  return { type: "handle", value: clean.startsWith("@") ? clean : `@${clean}` };
}

function formatDate(iso) {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}
