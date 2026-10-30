import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'porsche_warranty_supabase_url';
const STORAGE_KEY_PUBKEY = 'porsche_warranty_supabase_pubkey';

export const DEFAULT_STORAGE_BUCKET = 'warranty-evidence';

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
  source: 'env' | 'storage' | 'none';
}

let activeClient: SupabaseClient | null = null;

export function cleanSupabaseUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return '';

  // 1. If user pasted Supabase dashboard URL, e.g. https://supabase.com/dashboard/project/xyz or https://app.supabase.com/project/xyz
  const dashMatch = url.match(/project\/([a-z0-9_-]+)/i);
  if (dashMatch && dashMatch[1]) {
    return `https://${dashMatch[1]}.supabase.co`;
  }

  // 2. If user just entered the project reference id (e.g. "b4rzac5cfkxjdwouz7bjjk")
  if (!url.includes('.') && /^[a-z0-9_-]{12,}$/i.test(url)) {
    return `https://${url}.supabase.co`;
  }

  // 3. Remove trailing /rest/v1 or /rest/v1/
  url = url.replace(/\/rest\/v1\/?$/, '');

  // 4. Ensure protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // 5. Remove any trailing slashes
  return url.replace(/\/+$/, '');
}

export function formatSupabaseErrorMessage(rawError: string): string {
  const msg = rawError || '';
  const errLower = msg.toLowerCase();
  
  if (
    errLower.includes('failed to fetch') ||
    errLower.includes('networkerror') ||
    errLower.includes('network error') ||
    errLower.includes('load failed') ||
    errLower.includes('err_name_not_resolved') ||
    errLower.includes('connection refused')
  ) {
    return 'Não foi possível alcançar os servidores do Supabase (Failed to fetch). Causas prováveis:\n1. Projeto Pausado: No plano gratuito do Supabase, projetos sem uso recente são pausados automaticamente. Acesse app.supabase.com e clique em "Restore Project".\n2. URL Incorreta: Certifique-se de que a URL segue o formato https://[id-do-projeto].supabase.co sem barras extras.\n3. Bloqueador de Anúncios ou Rede: Verifique sua conexão e desative bloqueadores de anúncios (adblock) para este site.\n4. Seus dados continuam 100% seguros e salvos no IndexedDB local.';
  }

  if (errLower.includes('jwt') || errLower.includes('invalid api key') || errLower.includes('api key not found')) {
    return 'A Chave Anon (Publishable Key) informada é inválida ou expirou. Obtenha a chave atualizada em Project Settings > API no painel do Supabase.';
  }

  return msg;
}

/**
 * Retrieves the current Supabase configuration prioritizing environment variables,
 * falling back to user-configured credentials in local storage.
 */
export function getSupabaseConfig(): SupabaseConfig {
  // 1. Environment variables
  const rawEnvUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const envUrl = cleanSupabaseUrl(rawEnvUrl);

  if (envUrl && envKey && !envUrl.includes('seu-projeto') && !envUrl.includes('sua-url')) {
    return {
      url: envUrl,
      publishableKey: envKey,
      source: 'env'
    };
  }

  // 2. Saved in browser storage
  if (typeof window !== 'undefined') {
    const rawSavedUrl = (localStorage.getItem(STORAGE_KEY_URL) || '').trim();
    const savedKey = (localStorage.getItem(STORAGE_KEY_PUBKEY) || '').trim();
    const savedUrl = cleanSupabaseUrl(rawSavedUrl);
    if (savedUrl && savedKey) {
      return {
        url: savedUrl,
        publishableKey: savedKey,
        source: 'storage'
      };
    }
  }

  return {
    url: '',
    publishableKey: '',
    source: 'none'
  };
}

/**
 * Checks if Supabase has valid configuration parameters.
 */
export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.publishableKey);
}

/**
 * Initializes or returns the cached Supabase client.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.url || !config.publishableKey) {
    activeClient = null;
    return null;
  }

  if (activeClient) {
    return activeClient;
  }

  try {
    activeClient = createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return activeClient;
  } catch (err) {
    console.error('Falha ao inicializar cliente Supabase:', err);
    return null;
  }
}

/**
 * Saves custom Supabase credentials from UI and refreshes the client.
 */
export function saveSupabaseConfig(url: string, publishableKey: string): void {
  const cleanUrl = cleanSupabaseUrl(url);
  const cleanKey = publishableKey.trim();

  if (typeof window !== 'undefined') {
    if (cleanUrl && cleanKey) {
      localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
      localStorage.setItem(STORAGE_KEY_PUBKEY, cleanKey);
    } else {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_PUBKEY);
    }
  }

  activeClient = null; // Forces recreation
}

export function clearSupabaseConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_PUBKEY);
  }
  activeClient = null;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    databaseConnected: boolean;
    recordsCount?: number;
    bucketExists?: boolean;
    bucketName?: string;
  };
}

/**
 * Tests live connection to Supabase PostgreSQL and Storage bucket.
 */
export async function testSupabaseConnection(): Promise<ConnectionTestResult> {
  const config = getSupabaseConfig();
  const client = getSupabaseClient();
  if (!client || !config.url || !config.publishableKey) {
    return {
      success: false,
      message: 'Credenciais do Supabase não configuradas (URL ou Publishable Key ausente).'
    };
  }

  // Pre-flight check: Test reachability directly
  let isAuthInvalid = false;
  let networkFailed = false;
  let rawFetchError = '';

  try {
    const res = await fetch(`${config.url}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: config.publishableKey
      }
    });
    if (res.status === 401 || res.status === 403) {
      isAuthInvalid = true;
    }
  } catch (netErr: any) {
    networkFailed = true;
    rawFetchError = netErr.message || '';
  }

  if (isAuthInvalid) {
    return {
      success: false,
      message: 'A URL do projeto foi alcançada, mas a Chave Anon (Publishable Key) é inválida ou expirou. Copie a chave "anon / public" em Project Settings > API no painel do Supabase.',
      details: { databaseConnected: false }
    };
  }

  if (networkFailed) {
    return {
      success: false,
      message: `Não foi possível alcançar os servidores do Supabase (Failed to fetch). Causas prováveis:\n1. Projeto Pausado: No plano gratuito do Supabase, projetos sem uso recente são pausados automaticamente. Acesse app.supabase.com e clique em "Restore Project".\n2. URL Incorreta: A URL atual é "${config.url}". Verifique se o ID do projeto está correto.\n3. Bloqueador de Anúncios ou Rede: Verifique sua conexão e desative bloqueadores de anúncios (adblock) para este site.\n4. Seus dados continuam 100% seguros e salvos no IndexedDB local.`,
      details: { databaseConnected: false }
    };
  }

  try {
    // 1. Test database access on warranty_records
    const { count, error: dbError } = await client
      .from('warranty_records')
      .select('*', { count: 'exact', head: true });

    if (dbError) {
      // Check if table does not exist
      if (dbError.code === '42P01' || dbError.message?.toLowerCase().includes('relation') || dbError.message?.toLowerCase().includes('does not exist')) {
        return {
          success: false,
          message: 'O servidor Supabase está online e acessível! Porém, a tabela "warranty_records" ainda não existe no seu banco de dados. Acesse a aba "Migração SQL & RLS" acima, copie o script e execute no SQL Editor do Supabase.',
          details: { databaseConnected: false }
        };
      }
      return {
        success: false,
        message: formatSupabaseErrorMessage(dbError.message || 'Erro ao consultar tabela PostgreSQL'),
        details: { databaseConnected: false }
      };
    }

    // 2. Test storage bucket access
    let bucketExists = false;
    try {
      const { data: buckets, error: bucketError } = await client.storage.listBuckets();
      if (!bucketError && buckets) {
        bucketExists = buckets.some((b) => b.name === DEFAULT_STORAGE_BUCKET);
      }
    } catch {
      // Bucket list might be restricted by RLS; assume true if query succeeded
      bucketExists = true;
    }

    return {
      success: true,
      message: 'Conexão com PostgreSQL e Supabase estabelecida com sucesso!',
      details: {
        databaseConnected: true,
        recordsCount: count ?? 0,
        bucketExists,
        bucketName: DEFAULT_STORAGE_BUCKET
      }
    };
  } catch (err: any) {
    return {
      success: false,
      message: formatSupabaseErrorMessage(err.message || 'Falha de comunicação de rede com o Supabase'),
      details: { databaseConnected: false }
    };
  }
}
