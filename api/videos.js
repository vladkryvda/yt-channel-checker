// Example /api/videos.js (Node.js / Vercel Serverless Function)
export default async function handler(req, res) {
  const query = req.query.channel || req.query.q;
  const pageToken = req.query.pageToken || '';
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=video&key=${apiKey}&pageToken=${pageToken}`
    );
    const data = await ytRes.json();

    if (!ytRes.ok) {
      return res.status(ytRes.status).json({ error: data.error?.message || 'YouTube API error' });
    }

    const videos = data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      channelTitle: item.snippet.channelTitle,
      date: item.snippet.publishedAt
    }));

    return res.status(200).json({ videos, nextPageToken: data.nextPageToken || null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}