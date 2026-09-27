// Conexión central a Supabase — todos los módulos importan este archivo.
// Si el proyecto de Supabase cambia (URL o clave), esto es lo único que hay que tocar.
const SUPABASE_URL = 'https://vmrxfpgotbmmjxzizsuq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZRvab6Q78HaPX4ya9CCzHg_IzqZtrEa';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
