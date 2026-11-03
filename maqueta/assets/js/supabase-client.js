// Conexión central a Supabase. Todos los módulos cargan este archivo.
// Si el proyecto de Supabase cambia (URL o clave), esto es lo único que hay que tocar.
//
// IMPORTANTE: la librería (assets/vendor/supabase.js) ya ocupa el nombre global "supabase".
// Nunca declares otra variable llamada "supabase" en la app: el navegador rechaza el
// script completo y no corre nada. El cliente conectado se llama "db".
(function(){
  var URL = 'https://vmrxfpgotbmmjxzizsuq.supabase.co';
  var KEY = 'sb_publishable_ZRvab6Q78HaPX4ya9CCzHg_IzqZtrEa';
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.db = window.supabase.createClient(URL, KEY);
  } else {
    window.db = null;
    console.error('No se pudo cargar la librería de Supabase.');
  }
})();
