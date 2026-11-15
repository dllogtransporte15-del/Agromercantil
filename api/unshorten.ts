export default async function handler(req: any, res: any) {
  // Support both GET query and POST body
  const url = (req.query?.url || req.body?.url || '') as string;
  if (!url) {
    return res.status(400).json({ error: 'url parameter required' });
  }

  try {
    const response = await fetch(url, { redirect: 'follow' });
    return res.status(200).json({
      originalUrl: url,
      resolvedUrl: response.url
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Failed to unshorten URL',
      originalUrl: url
    });
  }
}
