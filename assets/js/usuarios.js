// Alta y baja de cuentas (vendedor, trabajador, admin). Solo lo ve un admin: si alguien más
// entra por la URL directa, se le manda de vuelta a Inicio sin mostrar nada.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja } = window.AH;
  const S = window.Sesion;
  const $ = (id) => document.getElementById(id);

  const NOMBRE_ROL = { admin:'Admin', vendedor:'Vendedor', trabajador:'Trabajador' };
  const NOMBRE_ESPECIALIDAD = {
    herrero:'Herrero', masilla_pintura:'Masilla y pintura', acabados:'Detalles', ventanero:'Aluminio', carpintero:'Carpintero'
  };
  // Un icono chiquito sobre el avatar según el tipo de cuenta, para distinguir de un vistazo.
  const ICONO_ROL = {
    admin:'<path d="M12 3l7 3v6c0 4.4-2.9 7.6-7 9-4.1-1.4-7-4.6-7-9V6z"/>',
    vendedor:'<path d="M20.6 12.6L12 21.2 2.8 12 11.4 3.4H18a2.6 2.6 0 0 1 2.6 2.6z"/><circle cx="15.5" cy="8.5" r="1"/>',
    trabajador:'<path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17v3h3l5.3-5.3"/>'
  };
  const inicial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();

  let usuarios = [];
  let quienSoy = null;
  let lineas = {};   // id de la vendedora -> 'hierro' | 'madera'

  async function llamar(accion, payload){
    const { data, error } = await db.functions.invoke('gestionar_usuarios', { body: { accion, payload } });
    if(error){
      let msg = 'No se pudo completar la acción';
      try{ const body = await error.context.json(); if(body && body.error) msg = body.error; }catch(e){}
      throw new Error(msg);
    }
    if(data && data.error) throw new Error(data.error);
    return data;
  }

  function subtitulo(u){
    if(u.rol !== 'trabajador') return NOMBRE_ROL[u.rol] || u.rol;
    const esp = (u.especialidades || []).map(e => NOMBRE_ESPECIALIDAD[e] || e);
    return esp.length ? esp.join(' · ') : 'Trabajador';
  }
  function iconoRol(u){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ICONO_ROL[u.rol] || ''}</svg>`;
  }
  function especialidadesHtml(u){
    const esp = (u.especialidades || []).map(e => NOMBRE_ESPECIALIDAD[e] || e);
    if(!esp.length) return '<span class="u-sub">Trabajador</span>';
    return `<div class="u-esp-fila">${esp.map(e => `<span class="u-esp">${esc(e)}</span>`).join('')}</div>`;
  }

  function pintarLista(){
    const cont = $('lista');
    $('subtitulo').textContent = usuarios.length + (usuarios.length === 1 ? ' usuario' : ' usuarios');
    if(!usuarios.length){ cont.innerHTML = '<div class="u-vacio">Todavía no hay usuarios.</div>'; return; }
    cont.innerHTML = usuarios.map((u, i) => `
      <button class="u-card ${u.activo ? '' : 'inactivo'}" data-id="${esc(u.id)}" style="--i:${i}">
        <span class="u-avatar-wrap">
          <span class="u-avatar">${esc(inicial(u.nombre))}</span>
          <span class="u-rolico">${iconoRol(u)}</span>
        </span>
        <span class="u-body">
          <span class="u-nombre" style="display:block">${esc(u.nombre)}</span>
          ${u.rol === 'trabajador' ? especialidadesHtml(u) : `<span class="u-sub">${esc(NOMBRE_ROL[u.rol] || u.rol)}</span>`}
        </span>
        ${u.activo ? '<svg class="u-flecha" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' : '<span class="u-badge">Inactivo</span>'}
      </button>`).join('');
  }

  async function cargar(){
    try{
      const r = await llamar('listar', {});
      usuarios = (r.usuarios || []).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      // Línea de cada vendedora (si falla, se ve como hierro)
      try{ const l = await db.from('perfiles').select('id,linea').eq('rol', 'vendedor'); if(!l.error) lineas = Object.fromEntries((l.data || []).map(x => [x.id, x.linea])); } catch(e){}
      pintarLista();
    } catch(e){
      $('lista').innerHTML = '<div class="u-vacio">No se pudo cargar. Desliza para reintentar.</div>';
      toast(e.message, 'error');
    }
  }

  // ---------------- Nuevo usuario ----------------
  let nRol = null, nEspecialidades = [];
  function marcarOpt(cont, valor){
    cont.querySelectorAll('.opt').forEach(b => b.classList.toggle('selected', b.dataset.v === valor));
  }
  $('nRol').addEventListener('click', (e) => {
    const b = e.target.closest('.opt'); if(!b) return;
    nRol = b.dataset.v;
    $('eRol').textContent = '';
    marcarOpt($('nRol'), nRol);
    $('fEspecialidad').classList.toggle('hidden', nRol !== 'trabajador');
  });
  // Especialidad: selección múltiple, cada toque prende o apaga esa opción sola.
  $('nEspecialidad').addEventListener('click', (e) => {
    const b = e.target.closest('.opt'); if(!b) return;
    const v = b.dataset.v;
    nEspecialidades = nEspecialidades.includes(v) ? nEspecialidades.filter(x => x !== v) : [...nEspecialidades, v];
    b.classList.toggle('selected', nEspecialidades.includes(v));
  });
  function limpiarForm(){
    $('nNombre').value = ''; $('nUsuario').value = ''; $('nPin').value = '';
    nRol = null; nEspecialidades = [];
    marcarOpt($('nRol'), null); marcarOpt($('nEspecialidad'), null);
    $('fEspecialidad').classList.add('hidden');
    ['eNombre', 'eUsuario', 'ePin', 'eEspecialidad', 'eRol'].forEach(id => $(id).textContent = '');
    $('hUsuario').classList.add('hidden');
  }
  // El usuario para entrar: sin acentos, sin espacios y en minúscula (jesús → jesus, luis paz → luispaz)
  const limpiarUsuario = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '');
  $('nUsuario').addEventListener('input', () => {
    const crudo = $('nUsuario').value.trim().toLowerCase();
    const limpio = limpiarUsuario(crudo);
    $('eUsuario').textContent = '';
    $('hUsuario').textContent = limpio ? 'Entrará como: ' + limpio : '';
    $('hUsuario').classList.toggle('hidden', !limpio || limpio === crudo);
  });
  $('btnNuevo').addEventListener('click', () => { limpiarForm(); abrirHoja('sheetNuevo'); });

  $('btnCrear').addEventListener('click', async () => {
    const nombre = $('nNombre').value.trim();
    const usuario = limpiarUsuario($('nUsuario').value);
    const pin = $('nPin').value.trim();
    ['eNombre', 'eUsuario', 'ePin', 'eEspecialidad', 'eRol'].forEach(id => $(id).textContent = '');
    let ok = true;
    if(!nombre){ $('eNombre').textContent = 'Escribe el nombre'; ok = false; }
    if(!usuario){ $('eUsuario').textContent = $('nUsuario').value.trim() ? 'Usa letras o números' : 'Escribe el usuario para entrar'; ok = false; }
    if(!/^\d{6}$/.test(pin)){ $('ePin').textContent = 'Debe ser de 6 números'; ok = false; }
    if(!nRol){ $('eRol').textContent = 'Elige el tipo de cuenta'; ok = false; }
    if(nRol === 'trabajador' && !nEspecialidades.length){ $('eEspecialidad').textContent = 'Elige al menos una especialidad'; ok = false; }
    if(!ok){
      // Lleva al primer campo con error para que se vea qué falta
      const err = ['eNombre', 'eUsuario', 'ePin', 'eRol', 'eEspecialidad'].map($).find(x => x.textContent);
      if(err) err.closest('.field').scrollIntoView({ block:'center', behavior:'smooth' });
      toast('Revisa lo que está en rojo', 'error');
      return;
    }

    $('btnCrear').disabled = true;
    try{
      await llamar('crear', { nombre, usuario, pin, rol:nRol, especialidades:nEspecialidades });
      cerrarHoja('sheetNuevo');
      toast('Usuario creado');
      cargar();
    } catch(e){
      toast(e.message, 'error');
    } finally {
      $('btnCrear').disabled = false;
    }
  });

  // ---------------- Ficha de usuario ----------------
  let fichaActual = null;
  function pintarFicha(u){
    fichaActual = u;
    const soyYo = quienSoy && quienSoy.id === u.id;
    $('fichaBody').innerHTML = `
      <div class="u-ficha-cab">
        <span class="u-avatar">${esc(inicial(u.nombre))}</span>
        <div><div class="u-nombre">${esc(u.nombre)}</div><div class="u-sub">${esc(subtitulo(u))} · usuario: ${esc(u.usuario)}</div></div>
      </div>
      ${u.rol === 'trabajador' ? `<div class="field" id="campoEsp" style="margin:14px 0 6px"><span class="field-label">Especialidades</span>
        <div class="opts" style="--cols:2">${Object.entries(NOMBRE_ESPECIALIDAD).map(([v, t]) => `<button type="button" class="opt ${(u.especialidades || []).includes(v) ? 'selected' : ''}" data-esp="${v}" aria-pressed="${(u.especialidades || []).includes(v)}">${esc(t)}</button>`).join('')}</div>
        <p class="field-error">Elige al menos una</p>
        <button class="btn-primary" type="button" data-accion="especialidades" style="margin-top:10px;height:48px">Guardar especialidades</button></div>` : ''}
      ${u.rol === 'vendedor' ? `<div class="field" style="margin:14px 0 6px"><span class="field-label">¿Qué vende más?</span>
        <div class="opts" style="--cols:2" id="optsLinea">${[['hierro', 'Hierro'], ['madera', 'Madera']].map(([v, t]) => `<button type="button" class="opt ${(lineas[u.id] || 'hierro') === v ? 'selected' : ''}" data-linea="${v}" aria-pressed="${(lineas[u.id] || 'hierro') === v}">${t}</button>`).join('')}</div>
        <p class="field-hint">Las dos venden de todo. La de madera además marca los pasos de las puertas de madera.</p></div>` : ''}
      <button class="f-link" data-accion="pin">Restablecer PIN</button>
      ${soyYo ? '' : `<button class="f-link" data-accion="${u.activo ? 'desactivar' : 'activar'}">${u.activo ? 'Desactivar cuenta' : 'Activar cuenta'}</button>`}
      ${soyYo ? '' : `<button class="btn-peligro" data-accion="eliminar">Eliminar usuario</button>`}
      ${soyYo ? '<p class="u-sub" style="margin-top:14px">Esta es tu propia cuenta, no se puede desactivar ni eliminar desde aquí.</p>' : ''}`;
    abrirHoja('sheetFicha');
  }
  $('lista').addEventListener('click', (e) => {
    const b = e.target.closest('.u-card'); if(!b) return;
    const u = usuarios.find(x => x.id === b.dataset.id);
    if(u) pintarFicha(u);
  });
  $('fichaBody').addEventListener('click', async (e) => {
    const ob = e.target.closest('[data-esp]');
    if(ob){ const on = !ob.classList.contains('selected'); ob.classList.toggle('selected', on); ob.setAttribute('aria-pressed', on); $('campoEsp').classList.remove('invalid'); return; }
    const bl = e.target.closest('[data-linea]');
    if(bl && fichaActual){
      const v = bl.dataset.linea, antes = lineas[fichaActual.id] || 'hierro';
      if(v === antes || bl.disabled) return;
      const caja = $('optsLinea');
      const marcar = (x) => caja.querySelectorAll('[data-linea]').forEach(o => { const on = o.dataset.linea === x; o.classList.toggle('selected', on); o.setAttribute('aria-pressed', on); });
      const uid = fichaActual.id;
      marcar(v);
      caja.querySelectorAll('button').forEach(o => o.disabled = true);
      try{
        const { error } = await db.rpc('usuario_linea', { uid, p_linea: v });
        if(error) throw error;
        lineas[uid] = v;
        toast(v === 'madera' ? 'Listo: vendedora de madera' : 'Listo: vendedora de hierro');
      } catch(err){ const m = String((err && err.message) || ''); marcar(antes); toast(/fetch|network|Failed/i.test(m) ? 'Sin conexión. Intenta de nuevo' : m || 'No se pudo guardar', 'error'); }
      caja.querySelectorAll('button').forEach(o => o.disabled = false);
      return;
    }
    const b = e.target.closest('[data-accion]'); if(!b || !fichaActual) return;
    const accion = b.dataset.accion;
    if(accion === 'especialidades'){
      const esp = [...$('fichaBody').querySelectorAll('[data-esp].selected')].map(x => x.dataset.esp);
      if(!esp.length){ $('campoEsp').classList.add('invalid'); return; }
      b.disabled = true;
      try{
        const { error } = await db.rpc('usuario_especialidades', { uid: fichaActual.id, esp });
        if(error) throw error;
        cerrarHoja('sheetFicha'); toast('Especialidades guardadas'); cargar();
      } catch(err){ const m = String((err && err.message) || ''); toast(/fetch|network|Failed/i.test(m) ? 'Sin conexión. Intenta de nuevo' : m || 'No se pudo guardar', 'error'); b.disabled = false; }
      return;
    }
    if(accion === 'pin'){ abrirHoja('sheetPin2'); return; }
    if(accion === 'eliminar'){
      if(!confirm(`¿Eliminar la cuenta de ${fichaActual.nombre}? No se puede deshacer.`)) return;
      try{ await llamar('eliminar', { id:fichaActual.id }); cerrarHoja('sheetFicha'); toast('Usuario eliminado'); cargar(); }
      catch(err){ toast(err.message, 'error'); }
      return;
    }
    if(accion === 'activar' || accion === 'desactivar'){
      try{ await llamar(accion, { id:fichaActual.id }); cerrarHoja('sheetFicha'); toast(accion === 'activar' ? 'Cuenta activada' : 'Cuenta desactivada'); cargar(); }
      catch(err){ toast(err.message, 'error'); }
    }
  });

  $('btnGuardarPin').addEventListener('click', async () => {
    const pin = $('rPin').value.trim();
    $('eRPin').textContent = '';
    if(!/^\d{6}$/.test(pin)){ $('eRPin').textContent = 'Debe ser de 6 números'; return; }
    $('btnGuardarPin').disabled = true;
    try{
      await llamar('resetPin', { id:fichaActual.id, pin });
      $('rPin').value = '';
      cerrarHoja('sheetPin2');
      cerrarHoja('sheetFicha');
      toast('PIN actualizado');
    } catch(e){
      toast(e.message, 'error');
    } finally {
      $('btnGuardarPin').disabled = false;
    }
  });

  (async function(){
    const p = await S.requerir();
    if(!p) return;
    if(p.rol !== 'admin'){ location.replace('index.html'); return; }
    quienSoy = await (async () => {
      const s = await S.sesionActual();
      return s ? { id: s.user.id } : null;
    })();
    await cargar();
    // Atajo desde Producción: ?especialidad=herrero
    const esp = new URLSearchParams(location.search).get('especialidad');
    if(esp && NOMBRE_ESPECIALIDAD[esp]){
      try{ history.replaceState(null, '', location.pathname); } catch(e){}
      toast(`Toca al trabajador y márcale ${NOMBRE_ESPECIALIDAD[esp]}. Si no existe, toca "Nuevo".`);
    }
  })();
})();
