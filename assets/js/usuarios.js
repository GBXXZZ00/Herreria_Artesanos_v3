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
    herrero:'Herrero', masilla_pintura:'Masilla y pintura', acabados:'Detalles', ventanero:'Ventanero', carpintero:'Carpintero'
  };
  const inicial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();

  let usuarios = [];
  let quienSoy = null;

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

  function pintarLista(){
    const cont = $('lista');
    $('subtitulo').textContent = usuarios.length + (usuarios.length === 1 ? ' usuario' : ' usuarios');
    if(!usuarios.length){ cont.innerHTML = '<div class="u-vacio">Todavía no hay usuarios.</div>'; return; }
    cont.innerHTML = usuarios.map((u, i) => `
      <button class="u-card ${u.activo ? '' : 'inactivo'}" data-id="${esc(u.id)}" style="--i:${i}">
        <span class="u-avatar">${esc(inicial(u.nombre))}</span>
        <span><span class="u-nombre" style="display:block">${esc(u.nombre)}</span><span class="u-sub">${esc(subtitulo(u))}</span></span>
        ${u.activo ? '' : '<span class="u-badge">Inactivo</span>'}
      </button>`).join('');
  }

  async function cargar(){
    try{
      const r = await llamar('listar', {});
      usuarios = (r.usuarios || []).sort((a, b) => (a.orden || 0) - (b.orden || 0));
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
    ['eNombre', 'eUsuario', 'ePin', 'eEspecialidad'].forEach(id => $(id).textContent = '');
  }
  $('btnNuevo').addEventListener('click', () => { limpiarForm(); abrirHoja('sheetNuevo'); });

  $('btnCrear').addEventListener('click', async () => {
    const nombre = $('nNombre').value.trim();
    const usuario = $('nUsuario').value.trim().toLowerCase();
    const pin = $('nPin').value.trim();
    ['eNombre', 'eUsuario', 'ePin', 'eEspecialidad'].forEach(id => $(id).textContent = '');
    let ok = true;
    if(!nombre){ $('eNombre').textContent = 'Escribe el nombre'; ok = false; }
    if(!/^[a-z0-9._-]+$/i.test(usuario)){ $('eUsuario').textContent = 'Solo letras, números, punto o guion'; ok = false; }
    if(!/^\d{6}$/.test(pin)){ $('ePin').textContent = 'Debe ser de 6 números'; ok = false; }
    if(!nRol){ toast('Elige el tipo de cuenta', 'error'); ok = false; }
    if(nRol === 'trabajador' && !nEspecialidades.length){ $('eEspecialidad').textContent = 'Elige al menos una especialidad'; ok = false; }
    if(!ok) return;

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
    const b = e.target.closest('[data-accion]'); if(!b || !fichaActual) return;
    const accion = b.dataset.accion;
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
    cargar();
  })();
})();
