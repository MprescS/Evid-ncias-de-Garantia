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

/**
 * Retrieves the current Supabase configuration prioritizing environment variables,
 * falling back to user-configured credentials in local storage.
 */
export function getSupabaseConfig(): SupabaseConfig {
  // 1. Environment variables
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey && envUrl !== 'https://seu-projeto.supabase.co' && !envUrl.includes('sua-url')) {
    return {
      url: envUrl,
      publishableKey: envKey,
      source: 'env'
    };
  }

  // 2. Saved in browser storage
  if (typeof window !== 'undefined') {
    const savedUrl = (localStorage.getItem(STORAGE_KEY_URL) || '').trim();
    const savedKey = (localStorage.getItem(STORAGE_KEY_PUBKEY) || '').trim();
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
  const cleanUrl = url.trim();
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
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Credenciais do Supabase não configuradas (URL ou Publishable Key ausente).'
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
          message: 'Conectou ao Supabase, mas a tabela "warranty_records" ainda não existe. Execute o script de migração SQL fornecido no painel do Supabase.',
          details: { databaseConnected: true }
        };
      }
      return {
        success: false,
        message: `Erro ao acessar tabela PostgreSQL: ${dbError.message}`,
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
      // Bucket list might be restricted by RLS; try test head upload or assume true
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
      message: `Falha na conexão de rede com o Supabase: ${err.message || 'Erro desconhecido'}`
    };
  }
}
