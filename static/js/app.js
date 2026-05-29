// ============================================================
// Control Finanzas — app.js
// Ok Web SAS · Jhon H. Vélez
// ============================================================

const CF = (() => {

  // ----------------------------------------------------------
  // ESTADO
  // ----------------------------------------------------------
  const S = {
    token:    localStorage.getItem('cf_token'),
    perfil:   localStorage.getItem('cf_perfil') || 'personal',
    tab:      'cxc',
    año:      new Date().getFullYear(),
    cuentas:  [],
    transacciones: [],
    categorias: [],
    alertas:  [],
    editId:   null,
    filtros: { concepto: '', moneda: '', recurrencia: '', tipo_tx: '', cat: '', desc: '' },
  };

  const PERFILES = {
    personal: { nombre: 'Jhon Harold Vélez Orozco', label: 'Personal' },
    laboral:  { nombre: 'Ok Web S.A.S.',            label: 'Ok Web S.A.S.' },
  };

  // ----------------------------------------------------------
  // UTILIDADES
  // ----------------------------------------------------------
  function fmtCOP(v) {
    return '$ ' + Math.round(v).toLocaleString('es-CO');
  }
  function fmtMoney(v, moneda) {
    return moneda === 'USD'
      ? 'USD ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : fmtCOP(v);
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ----------------------------------------------------------
  // TOAST
  // ----------------------------------------------------------
  let _toastTimer;
  function toast(msg, tipo = 'ok') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast-${tipo}`;
    el.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  // ----------------------------------------------------------
  // API
  // ----------------------------------------------------------
  function headers() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${S.token}` };
  }

  async function api(method, path, body) {
    const opts = { method, headers: headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(path, opts);
    if (r.status === 401) { logout(); return null; }
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: 'Error desconocido' }));
      throw new Error(err.detail || 'Error');
    }
    return r.json();
  }

  async function loadCuentas() {
    S.cuentas = await api('GET', `/api/cuentas?perfil=${S.perfil}`) || [];
  }
  async function loadTransacciones() {
    S.transacciones = await api('GET', `/api/transacciones?perfil=${S.perfil}&año=${S.año}`) || [];
  }
  async function loadCategorias() {
    S.categorias = await api('GET', '/api/categorias') || [];
  }
  async function loadAlertas() {
    S.alertas = await api('GET', '/api/cuentas/alertas') || [];
  }

  async function loadAll() {
    await Promise.all([loadCuentas(), loadTransacciones(), loadCategorias(), loadAlertas()]);
  }

  // ----------------------------------------------------------
  // AUTH
  // ----------------------------------------------------------
  function renderLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }

  function renderApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }

  function logout() {
    S.token = null;
    localStorage.removeItem('cf_token');
    renderLogin();
  }

  // ----------------------------------------------------------
  // NAVEGACIÓN
  // ----------------------------------------------------------
  function setPerfil(p) {
    S.perfil = p;
    localStorage.setItem('cf_perfil', p);
    _resetFiltros();
    loadAll().then(render);
  }

  function setTab(t) {
    S.tab = t;
    _resetFiltros();
    render();
  }

  function setAño(a) {
    S.año = a;
    loadTransacciones().then(render);
  }

  function _resetFiltros() {
    S.filtros = { concepto: '', moneda: '', recurrencia: '', tipo_tx: '', cat: '', desc: '' };
  }

  // ----------------------------------------------------------
  // RENDER PRINCIPAL
  // ----------------------------------------------------------
  function render() {
    _renderHeader();
    _renderAlertas();
    _renderBalance();
    _renderTabs();
    _renderContent();
  }

  function _renderHeader() {
    const bp = document.getElementById('btn-personal');
    const bl = document.getElementById('btn-laboral');
    bp.className = 'profile-btn' + (S.perfil === 'personal' ? ' active-personal' : '');
    bl.className = 'profile-btn' + (S.perfil === 'laboral'  ? ' active-laboral'  : '');

    // Año selector
    const sel = document.getElementById('year-selector');
    const cur = new Date().getFullYear();
    if (!sel.options.length) {
      for (let y = 2020; y <= cur + 1; y++) {
        sel.add(new Option(y, y));
      }
    }
    sel.value = S.año;
  }

  function _renderAlertas() {
    const banner = document.getElementById('alerts-banner');
    if (!S.alertas.length) { banner.classList.add('hidden'); return; }
    banner.classList.remove('hidden');

    const cls = a => a.vencida ? 'alert-vencida' : a.dias === 1 ? 'alert-1' : a.dias <= 8 ? 'alert-8' : 'alert-30';
    const lbl = a => {
      if (a.vencida) return `Vencida hace ${Math.abs(a.dias)} día(s)`;
      return `${a.dias === 1 ? 'Mañana' : `En ${a.dias} días`}`;
    };
    const tipo = a => a.tipo === 'cxc' ? 'Cobrar' : 'Pagar';
    const perfil = a => a.perfil === 'personal' ? '👤' : '🏢';

    banner.innerHTML = `
      <span id="alerts-title">⚠️ Alertas de vencimiento:</span>
      ${S.alertas.map(a => `
        <span class="alert-chip ${cls(a)}" onclick="CF.setTab('${a.tipo}')">
          ${perfil(a)} ${esc(a.concepto)} · ${tipo(a)} · ${lbl(a)}
        </span>
      `).join('')}
    `;
  }

  function _renderBalance() {
    const cxcItems = S.cuentas.filter(c => c.tipo === 'cxc');
    const cxpItems = S.cuentas.filter(c => c.tipo === 'cxp');
    const totalCxcCOP = cxcItems.filter(c => c.moneda === 'COP').reduce((s, c) => s + c.valor, 0);
    const totalCxcUSD = cxcItems.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.valor, 0);
    const totalCxpCOP = cxpItems.filter(c => c.moneda === 'COP').reduce((s, c) => s + c.valor, 0);
    const totalCxpUSD = cxpItems.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.valor, 0);
    const ingresos = S.transacciones.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.valor, 0);
    const egresos  = S.transacciones.filter(t => t.tipo === 'egreso').reduce((s, t)  => s + t.valor, 0);
    const saldo = ingresos - egresos;

    const subCxc = [totalCxcCOP ? fmtCOP(totalCxcCOP) : null, totalCxcUSD ? `USD ${totalCxcUSD.toFixed(2)}` : null].filter(Boolean).join(' + ') || '—';
    const subCxp = [totalCxpCOP ? fmtCOP(totalCxpCOP) : null, totalCxpUSD ? `USD ${totalCxpUSD.toFixed(2)}` : null].filter(Boolean).join(' + ') || '—';

    document.getElementById('balance-row').innerHTML = `
      <div class="balance-card bc-cxc">
        <div class="bc-label">Por cobrar</div>
        <div class="bc-value green">${cxcItems.length ? subCxc : '—'}</div>
        <div class="bc-sub">${cxcItems.length} registro(s)</div>
      </div>
      <div class="balance-card bc-cxp">
        <div class="bc-label">Por pagar</div>
        <div class="bc-value red">${cxpItems.length ? subCxp : '—'}</div>
        <div class="bc-sub">${cxpItems.length} registro(s)</div>
      </div>
      <div class="balance-card bc-libro ${S.perfil}">
        <div class="bc-label">Libro ${S.año}</div>
        <div class="bc-value ${saldo >= 0 ? 'green' : 'red'}">${fmtCOP(saldo)}</div>
        <div class="bc-sub">Ingresos ${fmtCOP(ingresos)} · Egresos ${fmtCOP(egresos)}</div>
      </div>
    `;
  }

  function _renderTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const active = btn.dataset.tab === S.tab;
      btn.className = 'tab-btn' + (active ? ` active-${S.perfil}` : '');
    });
  }

  function _renderContent() {
    if (S.tab === 'cxc' || S.tab === 'cxp') {
      _renderCuentas();
    } else {
      _renderLibro();
    }
  }

  // ----------------------------------------------------------
  // RENDER CUENTAS (CxC / CxP)
  // ----------------------------------------------------------
  function _renderCuentas() {
    const tipo = S.tab;
    const titulo = tipo === 'cxc' ? 'Cuentas por cobrar' : 'Cuentas por pagar';
    const perfilNombre = PERFILES[S.perfil].nombre;

    const datos = S.cuentas
      .filter(c => c.tipo === tipo)
      .filter(c => {
        const f = S.filtros;
        if (f.concepto   && !c.concepto.toLowerCase().includes(f.concepto.toLowerCase())) return false;
        if (f.moneda     && c.moneda !== f.moneda) return false;
        if (f.recurrencia && c.recurrencia !== f.recurrencia) return false;
        return true;
      });

    const addClass = S.perfil === 'laboral' ? 'laboral-mode' : '';

    document.getElementById('main-content').innerHTML = `
      <div class="toolbar">
        <div class="toolbar-title">${titulo} · ${esc(perfilNombre)}</div>
        <button class="btn-sm btn-notify" onclick="CF.verificarNotificaciones()">🔔 Verificar alertas</button>
        <button class="btn-sm btn-export" onclick="CF.exportar('cuentas','${tipo}')">⬇ Excel</button>
        <button class="btn-sm btn-add ${addClass}" onclick="CF.openModal()">+ Agregar</button>
      </div>
      <div class="filters-row">
        <input class="filter-input" placeholder="Buscar concepto…" value="${esc(S.filtros.concepto)}"
          oninput="CF._setFiltro('concepto', this.value)">
        <select class="filter-select" onchange="CF._setFiltro('moneda', this.value)">
          <option value="">Moneda: todas</option>
          <option value="COP" ${S.filtros.moneda==='COP'?'selected':''}>COP</option>
          <option value="USD" ${S.filtros.moneda==='USD'?'selected':''}>USD</option>
        </select>
        <select class="filter-select" onchange="CF._setFiltro('recurrencia', this.value)">
          <option value="">Recurrencia: todas</option>
          <option value="mensual" ${S.filtros.recurrencia==='mensual'?'selected':''}>Mensual</option>
          <option value="anual"   ${S.filtros.recurrencia==='anual'?'selected':''}>Anual</option>
          <option value="unica"   ${S.filtros.recurrencia==='unica'?'selected':''}>Única vez</option>
        </select>
        <button class="btn-clear-filters" onclick="CF._limpiarFiltros()">✕ Limpiar</button>
      </div>
      ${datos.length === 0 ? _emptyState('No hay registros') : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Concepto</th><th>Categoría</th><th>Detalle</th><th>Vencimiento</th>
                <th>Recurrencia</th><th class="td-right">Valor</th>
                <th>Moneda</th><th>Enlace</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${datos.map(c => _rowCuenta(c)).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  }

  function _rowCuenta(c) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const vence = new Date(c.fecha_vencimiento + 'T00:00:00');
    const diff = Math.round((vence - hoy) / 86400000);
    let rowCls = '';
    if (diff < 0)  rowCls = 'row-vencida';
    else if (diff <= 1)  rowCls = 'row-warn-1';
    else if (diff <= 8)  rowCls = 'row-warn-8';
    else if (diff <= 30) rowCls = 'row-warn-30';

    const recBadge = c.recurrencia
      ? `<span class="badge badge-${c.recurrencia}">${c.recurrencia}</span>`
      : '<span class="td-muted">—</span>';
    const urlLink = c.url
      ? `<a class="link-url" href="${esc(c.url)}" target="_blank" rel="noopener">🔗 ver</a>`
      : '<span class="td-muted">—</span>';

    const catNombre = c.categoria?.nombre || '—';
    return `
      <tr class="${rowCls}">
        <td><strong>${esc(c.concepto)}</strong></td>
        <td class="td-muted">${esc(catNombre)}</td>
        <td class="td-muted">${esc(c.detalle || '—')}</td>
        <td>${fmtDate(c.fecha_vencimiento)}</td>
        <td>${recBadge}</td>
        <td class="td-right td-mono">${fmtMoney(c.valor, c.moneda)}</td>
        <td><span class="badge badge-${c.moneda.toLowerCase()}">${c.moneda}</span></td>
        <td>${urlLink}</td>
        <td>
          <div class="actions">
            <button class="btn-edit" onclick="CF.openModal(${c.id})">Editar</button>
            <button class="btn-del"  onclick="CF.deleteCuenta(${c.id})">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }

  // ----------------------------------------------------------
  // RENDER LIBRO CONTABLE
  // ----------------------------------------------------------
  function _renderLibro() {
    const datos = S.transacciones.filter(t => {
      const f = S.filtros;
      if (f.tipo_tx && t.tipo !== f.tipo_tx) return false;
      if (f.cat && String(t.categoria_id) !== String(f.cat)) return false;
      if (f.desc && !t.descripcion.toLowerCase().includes(f.desc.toLowerCase())) return false;
      return true;
    });

    const addClass = S.perfil === 'laboral' ? 'laboral-mode' : '';
    const catOpts = S.categorias.map(c =>
      `<option value="${c.id}" ${S.filtros.cat===String(c.id)?'selected':''}>${esc(c.nombre)}</option>`
    ).join('');

    // Saldo acumulado (sobre datos filtrados)
    let saldoAcum = 0;
    const datosConSaldo = datos.map(t => {
      saldoAcum += t.tipo === 'ingreso' ? t.valor : -t.valor;
      return { ...t, saldoAcum };
    });

    // Resumen por categoría
    const resCat = {};
    S.transacciones.forEach(t => {
      const nom = t.categoria?.nombre || 'Sin categoría';
      if (!resCat[nom]) resCat[nom] = { ing: 0, egr: 0 };
      if (t.tipo === 'ingreso') resCat[nom].ing += t.valor;
      else resCat[nom].egr += t.valor;
    });

    document.getElementById('main-content').innerHTML = `
      <div class="toolbar">
        <div class="toolbar-title">Libro contable ${S.año} · ${esc(PERFILES[S.perfil].nombre)}</div>
        <button class="btn-sm btn-export" onclick="CF.exportar('libro')">⬇ Excel</button>
        <button class="btn-sm btn-add ${addClass}" onclick="CF.openModal()">+ Agregar</button>
      </div>
      <div class="filters-row">
        <input class="filter-input" placeholder="Buscar descripción…" value="${esc(S.filtros.desc)}"
          oninput="CF._setFiltro('desc', this.value)">
        <select class="filter-select" onchange="CF._setFiltro('tipo_tx', this.value)">
          <option value="">Tipo: todos</option>
          <option value="ingreso" ${S.filtros.tipo_tx==='ingreso'?'selected':''}>Ingreso</option>
          <option value="egreso"  ${S.filtros.tipo_tx==='egreso'?'selected':''}>Egreso</option>
        </select>
        <select class="filter-select" onchange="CF._setFiltro('cat', this.value)">
          <option value="">Categoría: todas</option>
          ${catOpts}
        </select>
        <button class="btn-clear-filters" onclick="CF._limpiarFiltros()">✕ Limpiar</button>
      </div>
      ${datos.length === 0 ? _emptyState('No hay transacciones para este año y perfil') : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Categoría</th><th>Descripción</th>
                <th>Tipo</th><th class="td-right">Valor</th><th class="td-right">Saldo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${datosConSaldo.map(t => _rowTransaccion(t)).join('')}
            </tbody>
          </table>
        </div>
      `}
      <div class="resumen-section">
        <div class="resumen-title">Subtotales por categoría — ${S.año}</div>
        <div class="resumen-grid">
          ${Object.entries(resCat).sort((a,b)=>a[0].localeCompare(b[0])).map(([nom, v]) => `
            <div class="resumen-cat-card">
              <div class="rcc-nombre">${esc(nom)}</div>
              ${v.ing ? `<div class="rcc-row"><span>Ingresos</span><span class="rcc-ingreso">${fmtCOP(v.ing)}</span></div>` : ''}
              ${v.egr ? `<div class="rcc-row"><span>Egresos</span><span class="rcc-egreso">${fmtCOP(v.egr)}</span></div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function _rowTransaccion(t) {
    const catNom = t.categoria?.nombre || 'Sin categoría';
    return `
      <tr>
        <td>${fmtDate(t.fecha)}</td>
        <td>${esc(catNom)}</td>
        <td>${esc(t.descripcion)}</td>
        <td><span class="badge badge-${t.tipo}">${t.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</span></td>
        <td class="td-right td-mono">${fmtCOP(t.valor)}</td>
        <td class="td-right td-mono ${t.saldoAcum >= 0 ? 'saldo-pos' : 'saldo-neg'}">${fmtCOP(t.saldoAcum)}</td>
        <td>
          <div class="actions">
            <button class="btn-edit" onclick="CF.openModal(${t.id})">Editar</button>
            <button class="btn-del"  onclick="CF.deleteTransaccion(${t.id})">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }

  // ----------------------------------------------------------
  // MODAL
  // ----------------------------------------------------------
  async function openModal(id) {
    S.editId = id || null;
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.onclick = e => { if (e.target === overlay) closeModal(); };

    // Recargar categorías para ambos formularios
    try { await loadCategorias(); } catch (_) { /* continuar con S.categorias actual */ }

    if (S.tab === 'cxc' || S.tab === 'cxp') {
      _renderFormCuenta(id);
    } else {
      _renderFormTransaccion(id);
    }
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    S.editId = null;
  }

  // -- Formulario Cuenta --
  function _renderFormCuenta(id) {
    const c = id ? S.cuentas.find(x => x.id === id) : null;
    const titulo = c ? 'Editar cuenta' : `Nueva cuenta — ${S.tab === 'cxc' ? 'por cobrar' : 'por pagar'}`;
    document.getElementById('modal-title').textContent = titulo;

    const addClass = S.perfil === 'laboral' ? 'laboral-mode' : '';
    const v = f => c ? (c[f] || '') : '';

    const catChipsCuenta = S.categorias.map(cat => `
      <div class="cat-chip ${String(v('categoria_id')) === String(cat.id) ? 'cat-chip-sel' : ''}"
           onclick="CF._selCat(this,'${cat.id}')">${esc(cat.nombre)}</div>
    `).join('');

    document.getElementById('modal-body').innerHTML = `
      <div class="form-section-title">${esc(PERFILES[S.perfil].nombre)} · ${S.tab.toUpperCase()}</div>
      <div class="form-group">
        <label class="form-label">Concepto / empresa *</label>
        <input id="f-concepto" class="form-control" placeholder="Nombre del deudor o empresa" value="${esc(v('concepto'))}">
      </div>
      <div class="form-group">
        <label class="form-label">Categoría <span style="font-weight:400;color:var(--text-muted)">(${S.categorias.length} disponibles)</span></label>
        <input type="hidden" id="f-categoria" value="${v('categoria_id') || ''}">
        <div class="cat-chips" id="cat-chips">
          <div class="cat-chip ${!v('categoria_id') ? 'cat-chip-sel' : ''}"
               onclick="CF._selCat(this,'')">Sin categoría</div>
          ${catChipsCuenta}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Detalle</label>
        <textarea id="f-detalle" class="form-control" rows="2" placeholder="Descripción adicional">${esc(v('detalle'))}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha de vencimiento *</label>
          <input id="f-fecha" type="date" class="form-control" value="${v('fecha_vencimiento')}">
        </div>
        <div class="form-group">
          <label class="form-label">Recurrencia</label>
          <select id="f-recurrencia" class="form-control">
            <option value="">— ninguna —</option>
            <option value="mensual" ${v('recurrencia')==='mensual'?'selected':''}>Mensual</option>
            <option value="anual"   ${v('recurrencia')==='anual'?'selected':''}>Anual</option>
            <option value="unica"   ${v('recurrencia')==='unica'?'selected':''}>Única vez</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Valor *</label>
          <input id="f-valor" type="number" step="1" min="0" class="form-control" placeholder="0" value="${v('valor')}">
        </div>
        <div class="form-group">
          <label class="form-label">Moneda</label>
          <select id="f-moneda" class="form-control">
            <option value="COP" ${v('moneda') !== 'USD' ? 'selected' : ''}>COP</option>
            <option value="USD" ${v('moneda') === 'USD' ? 'selected' : ''}>USD</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">URL de pago o sitio web</label>
        <input id="f-url" type="url" class="form-control" placeholder="https://…" value="${esc(v('url'))}">
      </div>
      <div class="form-actions">
        <button class="btn-cancel" onclick="CF.closeModal()">Cancelar</button>
        <button class="btn-save ${addClass}" onclick="CF.saveCuenta()">
          ${c ? 'Guardar cambios' : 'Agregar'}
        </button>
      </div>
    `;
  }

  // -- Formulario Transacción --
  function _renderFormTransaccion(id) {
    const t = id ? S.transacciones.find(x => x.id === id) : null;
    const titulo = t ? 'Editar transacción' : 'Nueva transacción';
    document.getElementById('modal-title').textContent = titulo;

    const addClass = S.perfil === 'laboral' ? 'laboral-mode' : '';
    const v = f => t ? (t[f] ?? '') : '';
    const today = todayISO();

    const catOpts = S.categorias.map(c =>
      `<option value="${c.id}" ${v('categoria_id') == c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`
    ).join('');

    document.getElementById('modal-body').innerHTML = `
      <div class="form-section-title">${esc(PERFILES[S.perfil].nombre)}</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha *</label>
          <input id="f-fecha" type="date" class="form-control" value="${v('fecha') || today}">
        </div>
        <div class="form-group">
          <label class="form-label">Tipo *</label>
          <select id="f-tipo" class="form-control">
            <option value="ingreso" ${v('tipo')==='ingreso'?'selected':''}>Ingreso</option>
            <option value="egreso"  ${v('tipo')==='egreso'?'selected':''}>Egreso</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Categoría <span style="font-weight:400;color:var(--text-muted)">(${S.categorias.length} disponibles)</span></label>
        <input type="hidden" id="f-categoria" value="${v('categoria_id') || ''}">
        <div class="cat-chips" id="cat-chips">
          <div class="cat-chip ${!v('categoria_id') ? 'cat-chip-sel' : ''}"
               onclick="CF._selCat(this,'')">Sin categoría</div>
          ${S.categorias.map(c => `
            <div class="cat-chip ${String(v('categoria_id')) === String(c.id) ? 'cat-chip-sel' : ''}"
                 onclick="CF._selCat(this,'${c.id}')">${esc(c.nombre)}</div>
          `).join('')}
        </div>
        <div class="cat-nueva">
          <input id="f-cat-nueva" class="form-control" placeholder="+ Nueva categoría…">
          <button class="btn-cat-add" onclick="CF.crearCategoria()">Crear</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción *</label>
        <input id="f-desc" class="form-control" placeholder="¿De qué se trata?" value="${esc(v('descripcion'))}">
      </div>
      <div class="form-group">
        <label class="form-label">Valor *</label>
        <input id="f-valor" type="number" step="1" min="0" class="form-control" placeholder="0" value="${v('valor')}">
      </div>
      <div class="form-actions">
        <button class="btn-cancel" onclick="CF.closeModal()">Cancelar</button>
        <button class="btn-save ${addClass}" onclick="CF.saveTransaccion()">
          ${t ? 'Guardar cambios' : 'Agregar'}
        </button>
      </div>
    `;
  }

  // ----------------------------------------------------------
  // CRUD CUENTAS
  // ----------------------------------------------------------
  async function saveCuenta() {
    const concepto = document.getElementById('f-concepto').value.trim();
    const fecha    = document.getElementById('f-fecha').value;
    const valor    = parseFloat(document.getElementById('f-valor').value);

    if (!concepto || !fecha || isNaN(valor) || valor <= 0) {
      toast('Concepto, fecha y valor son obligatorios', 'err');
      return;
    }

    const catIdRaw = (document.getElementById('f-categoria')?.value || '').trim();
    const payload = {
      perfil:            S.perfil,
      tipo:              S.tab,
      concepto,
      detalle:           document.getElementById('f-detalle').value.trim() || null,
      fecha_vencimiento: fecha,
      recurrencia:       document.getElementById('f-recurrencia').value || null,
      valor,
      moneda:            document.getElementById('f-moneda').value,
      url:               document.getElementById('f-url').value.trim() || null,
      categoria_id:      catIdRaw ? parseInt(catIdRaw) : null,
    };

    try {
      if (S.editId) {
        await api('PUT', `/api/cuentas/${S.editId}`, payload);
        toast('Cuenta actualizada');
      } else {
        await api('POST', '/api/cuentas', payload);
        toast('Cuenta agregada');
      }
      closeModal();
      await loadCuentas();
      await loadAlertas();
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  async function deleteCuenta(id) {
    if (!confirm('¿Eliminar esta cuenta?')) return;
    try {
      await api('DELETE', `/api/cuentas/${id}`);
      toast('Cuenta eliminada');
      await loadCuentas();
      await loadAlertas();
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  // ----------------------------------------------------------
  // CRUD TRANSACCIONES
  // ----------------------------------------------------------
  async function saveTransaccion() {
    const fecha  = document.getElementById('f-fecha').value;
    const desc   = document.getElementById('f-desc').value.trim();
    const valor  = parseFloat(document.getElementById('f-valor').value);
    const tipo   = document.getElementById('f-tipo').value;
    const catId  = (document.getElementById('f-categoria')?.value || '').trim();

    if (!fecha || !desc || isNaN(valor) || valor <= 0) {
      toast('Fecha, descripción y valor son obligatorios', 'err');
      return;
    }

    const payload = {
      perfil:       S.perfil,
      categoria_id: catId ? parseInt(catId) : null,
      fecha,
      descripcion:  desc,
      valor,
      tipo,
    };

    try {
      if (S.editId) {
        await api('PUT', `/api/transacciones/${S.editId}`, payload);
        toast('Transacción actualizada');
      } else {
        await api('POST', '/api/transacciones', payload);
        toast('Transacción agregada');
      }
      closeModal();
      await loadTransacciones();
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  async function deleteTransaccion(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
      await api('DELETE', `/api/transacciones/${id}`);
      toast('Transacción eliminada');
      await loadTransacciones();
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  // ----------------------------------------------------------
  // SELECTOR DE CATEGORÍA (chips)
  // ----------------------------------------------------------
  function _selCat(chip, id) {
    document.querySelectorAll('#cat-chips .cat-chip').forEach(c => c.classList.remove('cat-chip-sel'));
    chip.classList.add('cat-chip-sel');
    document.getElementById('f-categoria').value = id;
  }

  // ----------------------------------------------------------
  // CATEGORÍAS
  // ----------------------------------------------------------
  async function crearCategoria() {
    const input = document.getElementById('f-cat-nueva');
    const nombre = input.value.trim();
    if (!nombre) return;
    try {
      await api('POST', '/api/categorias', { nombre });
      toast(`Categoría "${nombre}" creada`);
      input.value = '';
      await loadCategorias();
      // Re-render form preservando datos
      _renderFormTransaccion(S.editId);
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  // ----------------------------------------------------------
  // NOTIFICACIONES
  // ----------------------------------------------------------
  async function verificarNotificaciones() {
    try {
      const r = await api('POST', '/api/notificaciones/verificar');
      toast(r.mensaje);
      await loadAlertas();
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  // ----------------------------------------------------------
  // EXPORTAR
  // ----------------------------------------------------------
  function exportar(modulo, tipo) {
    let url = `/api/exportar/${modulo}?perfil=${S.perfil}`;
    if (modulo === 'cuentas' && tipo) url += `&tipo=${tipo}`;
    if (modulo === 'libro') url += `&año=${S.año}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    // Necesita token — hacemos fetch manual
    fetch(url, { headers: headers() })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${modulo}_${S.perfil}_${S.año}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast('Error al exportar', 'err'));
  }

  // ----------------------------------------------------------
  // FILTROS
  // ----------------------------------------------------------
  function _setFiltro(key, val) {
    S.filtros[key] = val;
    _renderContent();
  }

  function _limpiarFiltros() {
    _resetFiltros();
    _renderContent();
  }

  // ----------------------------------------------------------
  // EMPTY STATE
  // ----------------------------------------------------------
  function _emptyState(msg) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>${msg}</p>
      </div>
    `;
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  async function init() {
    if (!S.token) {
      renderLogin();
      return;
    }
    await loadAll();
    renderApp();
    render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Login form
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const pw = document.getElementById('password-input').value;
      const errEl = document.getElementById('login-error');
      errEl.classList.add('hidden');
      try {
        const r = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw }),
        });
        if (!r.ok) { errEl.classList.remove('hidden'); return; }
        const data = await r.json();
        S.token = data.token;
        localStorage.setItem('cf_token', data.token);
        await loadAll();
        renderApp();
        render();
      } catch {
        errEl.classList.remove('hidden');
      }
    });

    init();
  });

  // API pública
  return {
    setPerfil, setTab, setAño, logout, openModal, closeModal,
    saveCuenta, deleteCuenta, saveTransaccion, deleteTransaccion,
    crearCategoria, verificarNotificaciones, exportar,
    _setFiltro, _limpiarFiltros, _selCat,
  };

})();
