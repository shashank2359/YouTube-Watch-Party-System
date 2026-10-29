const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(['youtube.com', 'music.youtube.com', 'youtube-nocookie.com']);

/** Returns an 11-char video ID from a raw ID or a supported YouTube URL, else null. */
export function extractVideoId(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (VIDEO_ID.test(value)) return value;

  let url;
  try {
    url = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.replace(/^(www|m)\./, '');
  let candidate = null;
  if (host === 'youtu.be') {
    candidate = url.pathname.slice(1).split('/')[0];
  } else if (YT_HOSTS.has(host)) {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      const match = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?]+)/);
      candidate = match ? match[2] : null;
    }
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}
