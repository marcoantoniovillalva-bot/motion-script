// Vecteezy V2 API client (TypeScript, erasable-types-only so Node >=23 runs it natively).
//
// Endpoint shape verified live on 2026-07-15 (the official docs are thin — this comes
// from a working Swagger session + probing):
//   GET https://api.vecteezy.com/v2/{account_id}/resources?term=&content_type=&per_page=
//   GET https://api.vecteezy.com/v2/{account_id}/resources/{id}
//   GET https://api.vecteezy.com/v2/{account_id}/resources/{id}/download  -> { url }
// Auth: `Authorization: Bearer <VECTEEZY_API_SECRET>` — the account SECRET works as the
// bearer token; the old V1 `Token` auth is rejected for this account ("V1 API usage is
// not permitted"). account_id goes in the PATH, not in a header.
//
// .env.local:
//   VECTEEZY_API_ID=123456          # account id (path segment)
//   VECTEEZY_API_SECRET=sk_xxxxx    # used as Bearer token
//
// CLI smoke test:  node scripts/vecteezy-client.ts "3d robot emoji"
//
// Example Next.js route handler (app/api/vecteezy/route.ts):
//   import { searchResources } from '@/scripts/vecteezy-client';
//   export async function GET(req: Request) {
//     const term = new URL(req.url).searchParams.get('term') ?? '';
//     try {
//       const res = await searchResources({ term, contentType: 'photo', perPage: 10 });
//       return Response.json(res);
//     } catch (e) {
//       const err = e as VecteezyError;
//       return Response.json({ error: err.message }, { status: err.status ?? 500 });
//     }
//   }

const BASE = 'https://api.vecteezy.com/v2';

export type VecteezyContentType = 'photo' | 'video' | 'vector';

export type VecteezyResource = {
  id: number;
  title: string;
  content_type: string;
  license_type?: string;
  thumbnail_url?: string;
  tags: string[];
  file_metadata?: {
    available_file_types?: { extension: string; size_in_bytes: number }[];
    available_download_sizes?: { id: string; width: number; height: number }[];
  };
};

export type VecteezySearchResult = {
  page: number;
  last_page: number;
  per_page: number;
  total_resources: number;
  resources: VecteezyResource[];
};

export class VecteezyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'VecteezyError';
    this.status = status;
  }
}

function credentials(): { accountId: string; secret: string } {
  const accountId = process.env.VECTEEZY_API_ID;
  const secret = process.env.VECTEEZY_API_SECRET;
  if (!accountId || !secret) {
    throw new VecteezyError('VECTEEZY_API_ID / VECTEEZY_API_SECRET non configurate (vedi .env.local)');
  }
  return { accountId, secret };
}

async function vFetch(path: string): Promise<unknown> {
  const { accountId, secret } = credentials();
  const res = await fetch(`${BASE}/${accountId}${path}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
  });
  const body = await res.text();
  if (!res.ok) {
    let message = `Vecteezy HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { errors?: { message?: string }[] };
      if (parsed.errors?.[0]?.message) message += `: ${parsed.errors[0].message}`;
    } catch {
      message += `: ${body.slice(0, 200)}`;
    }
    throw new VecteezyError(message, res.status);
  }
  return JSON.parse(body);
}

/** Search resources. `term` is required by the API; free accounts get full search. */
export async function searchResources(opts: {
  term: string;
  contentType?: VecteezyContentType;
  perPage?: number;
  page?: number;
}): Promise<VecteezySearchResult> {
  const params = new URLSearchParams({
    term: opts.term,
    content_type: opts.contentType ?? 'photo',
    per_page: String(opts.perPage ?? 5),
    page: String(opts.page ?? 1),
  });
  return (await vFetch(`/resources?${params}`)) as VecteezySearchResult;
}

export async function getResourceById(id: number): Promise<VecteezyResource> {
  return (await vFetch(`/resources/${id}`)) as VecteezyResource;
}

/** Returns a signed, time-limited direct download URL for the resource file. */
export async function getDownloadUrl(id: number, size?: string): Promise<string> {
  const suffix = size ? `?size=${encodeURIComponent(size)}` : '';
  const data = (await vFetch(`/resources/${id}/download${suffix}`)) as { url?: string };
  if (!data.url) throw new VecteezyError(`Nessun url di download per la risorsa ${id}`);
  return data.url;
}

/** Search + download the first match to a local file. Returns the resource used, or null when nothing matches. */
export async function downloadFirstMatch(opts: {
  term: string;
  contentType?: VecteezyContentType;
  toFile: string;
  size?: string;
}): Promise<VecteezyResource | null> {
  const { writeFile } = await import('fs/promises');
  const result = await searchResources({ term: opts.term, contentType: opts.contentType, perPage: 3 });
  const first = result.resources[0];
  if (!first) return null;
  const url = await getDownloadUrl(first.id, opts.size);
  const res = await fetch(url);
  if (!res.ok) throw new VecteezyError(`Download fallito (HTTP ${res.status})`, res.status);
  await writeFile(opts.toFile, Buffer.from(await res.arrayBuffer()));
  return first;
}

// CLI smoke test: node scripts/vecteezy-client.ts "search term" [photo|video|vector]
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop() ?? '');
if (isMain) {
  const { readFile } = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const filename of ['.env', '.env.local']) {
    try {
      const env = await readFile(path.join(rootDir, filename), 'utf-8');
      for (const line of env.split('\n')) {
        const t = line.trim().replace(/^﻿/, '');
        if (!t || t.startsWith('#') || !t.includes('=')) continue;
        const i = t.indexOf('=');
        process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
      }
    } catch {}
  }
  const term = process.argv[2] ?? '3d robot emoji';
  const type = (process.argv[3] as VecteezyContentType) ?? 'photo';
  const out = await searchResources({ term, contentType: type, perPage: 3 });
  console.log(`${out.total_resources} risultati per "${term}" (${type}):`);
  for (const r of out.resources) console.log(`  #${r.id} ${r.title.slice(0, 80)}`);
  if (out.resources[0]) console.log('Download URL:', (await getDownloadUrl(out.resources[0].id)).slice(0, 100) + '…');
}
