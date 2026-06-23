import { Readable } from 'node:stream';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path || '';
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const upstream = await fetch(`https://api.openai.com/v1/${path}`, {
    method: req.method,
    headers: {
      Authorization: req.headers.authorization || '',
      'Content-Type': req.headers['content-type'] || 'application/json',
    },
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });

  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');

  await new Promise((resolve, reject) => {
    Readable.fromWeb(upstream.body).pipe(res).on('finish', resolve).on('error', reject);
  });
}
