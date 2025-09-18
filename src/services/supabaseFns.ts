export function getSupaEnv() {
  const fnUrl = import.meta.env.VITE_SUPABASE_FN_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!fnUrl || !anonKey) throw new Error('Supabase Function URL or Anon Key is not configured. Check .env.local.');
  return { fnUrl, anonKey };
}

export async function callFn(name: string, payload: unknown) {
  const { fnUrl, anonKey } = getSupaEnv();
  return fetch(`${fnUrl}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function callFnJson<T = unknown>(name: string, payload: unknown): Promise<{ ok: boolean; status: number; data?: T; text?: string; }>{
  const res = await callFn(name, payload);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

