export interface Env {
  PIPICARDS_IMAGES: R2Bucket;
  UPLOAD_SECRET: string;
}

const PUBLIC_BASE = 'https://pub-cbda7721ae3446c58df6f3a293e55f80.r2.dev';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST' || url.pathname !== '/upload') {
      return new Response('Not found', { status: 404 });
    }

    const auth = request.headers.get('Authorization');
    if (auth !== `Bearer ${env.UPLOAD_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ error: 'Invalid multipart data' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE) {
      return Response.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `${crypto.randomUUID()}.${ext}`;

    await env.PIPICARDS_IMAGES.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    return Response.json(
      { url: `${PUBLIC_BASE}/${key}` },
      { headers: corsHeaders() }
    );
  },
};

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}
