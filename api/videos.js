// /api/videos.js (Node.js / Vercel Serverless Function)
export default async function handler(req, res) {
  const { playlistId, videoId, channel, q, order, publishedAfter, pageToken = '' } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'YOUTUBE_API_KEY is not configured on server' });
  }

  try {
    // 1. Якщо передано ID ПЛЕЙЛИСТА (запит до playlistItems)
    if (playlistId) {
      const ytUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      ytUrl.searchParams.append('part', 'snippet,contentDetails');
      ytUrl.searchParams.append('maxResults', '24');
      ytUrl.searchParams.append('playlistId', playlistId);
      ytUrl.searchParams.append('key', apiKey);
      if (pageToken) ytUrl.searchParams.append('pageToken', pageToken);

      const ytRes = await fetch(ytUrl.toString());
      const data = await ytRes.json();

      if (!ytRes.ok) {
        return res.status(ytRes.status).json({ error: data.error?.message || 'YouTube API error' });
      }

      // Фільтруємо приватні/видалені відео та форматуємо результат
      const videos = (data.items || [])
        .filter(item => item.snippet && item.snippet.title !== 'Private video' && item.snippet.title !== 'Deleted video')
        .map(item => ({
          id: item.snippet.resourceId?.videoId || item.contentDetails?.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
          channelTitle: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle || '',
          date: item.contentDetails?.videoPublishedAt || item.snippet.publishedAt || ''
        }));

      return res.status(200).json({ videos, nextPageToken: data.nextPageToken || null });
    }

    // 2. Якщо передано ID ПООДИНОКОГО ВІДЕО
    if (videoId) {
      const ytUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
      ytUrl.searchParams.append('part', 'snippet');
      ytUrl.searchParams.append('id', videoId);
      ytUrl.searchParams.append('key', apiKey);

      const ytRes = await fetch(ytUrl.toString());
      const data = await ytRes.json();

      if (!ytRes.ok) {
        return res.status(ytRes.status).json({ error: data.error?.message || 'YouTube API error' });
      }

      const videos = (data.items || []).map(item => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
        channelTitle: item.snippet.channelTitle || '',
        date: item.snippet.publishedAt || ''
      }));

      return res.status(200).json({ videos, nextPageToken: null });
    }

    // 3. ЗВИЧАЙНИЙ ПОШУК АБО ПОШУК ПО КАНАЛУ / @HANDLE
    const searchQuery = q || channel;
    if (!searchQuery) {
      return res.status(400).json({ error: 'Missing query or playlistId' });
    }

    const ytUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    ytUrl.searchParams.append('part', 'snippet');
    ytUrl.searchParams.append('maxResults', '12');
    ytUrl.searchParams.append('type', 'video');
    ytUrl.searchParams.append('key', apiKey);

    // Якщо це прямий channelId (починається з UC і має довжину 24 символи)
    if (channel && channel.startsWith('UC') && channel.length === 24) {
      ytUrl.searchParams.append('channelId', channel);
    } else {
      ytUrl.searchParams.append('q', searchQuery);
    }

    if (order) ytUrl.searchParams.append('order', order);
    if (publishedAfter) ytUrl.searchParams.append('publishedAfter', publishedAfter);
    if (pageToken) ytUrl.searchParams.append('pageToken', pageToken);

    const ytRes = await fetch(ytUrl.toString());
    const data = await ytRes.json();

    if (!ytRes.ok) {
      return res.status(ytRes.status).json({ error: data.error?.message || 'YouTube API error' });
    }

    const videos = (data.items || []).map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
      channelTitle: item.snippet.channelTitle || '',
      date: item.snippet.publishedAt || ''
    }));

    return res.status(200).json({ videos, nextPageToken: data.nextPageToken || null });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
