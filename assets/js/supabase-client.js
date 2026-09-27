// Conexión central a Supabase — todos los módulos importan este archivo.
// Si el proyecto de Supabase cambia (URL o clave), esto es lo único que hay que tocar.
//
// OJO: guardamos el cliente en window.supabaseClient (NO en una variable "supabase" suelta).
// La librería del CDN ya usa el nombre global "supabase" para SU PROPIO objeto (el que tiene
// .createClient). Si aquí lo reemplazábamos con "const supabase = ...", cualquier página donde
// este script no llegara a cargar a tiempo (conexión lenta, error de red) hacía que el resto del
// código igual encontrara un "supabase" definido — pero el de la librería, no el cliente — y
// fallaba con "supabase.from is not a function" sin avisar nada. Con window.supabaseClient esto
// ya no puede pasar: si no cargó, supabaseClient queda undefined y el error se detecta bien.
const SUPABASE_URL = 'https://vmrxfpgotbmmjxzizsuq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZRvab6Q78HaPX4ya9CCzHg_IzqZtrEa';

if(window.supabase && typeof window.supabase.createClient === 'function'){
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.error('No se pudo cargar la librería de Supabase desde el CDN.');
}
