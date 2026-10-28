import { createDemoApi } from "./demoApi";
import { createSupabaseApi } from "./supabaseApi";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const api = url && key ? createSupabaseApi(url, key) : createDemoApi();
export type { Api, GameDetail } from "./types";
