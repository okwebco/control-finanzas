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
    año:      Math.max(new Date().getFullYear(), 2026),
    mes:      0,  // 0 = todos, 1-12 = mes específico
    cuentas:  [],
    transacciones: [],
    categorias: [],
    alertas:  [],
    editId:   null,
    filtros: { concepto: '', moneda: '', recurrencia: '', tipo_tx: '', cat: '', desc: '' },
    catTabFiltro: '',   // Filtro tipo en modal Categorías: '' | 'cxc' | 'cxp'
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

  function setMes(m) {
    S.mes = m;
    render();
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

    // Año selector — desde 2026
    const sel = document.getElementById('year-selector');
    const cur = Math.max(new Date().getFullYear(), 2026);
    if (!sel.options.length) {
      for (let y = 2026; y <= cur + 1; y++) {
        sel.add(new Option(y, y));
      }
    }
    sel.value = S.año;

    // Mes selector
    const msel = document.getElementById('month-selector');
    if (!msel.options.length) {
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      msel.add(new Option('Todos', 0));
      meses.forEach((m, i) => msel.add(new Option(m, i + 1)));
    }
    msel.value = S.mes;
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
  function _buildCuentasData() {
    const tipo = S.tab;
    const datos = S.cuentas
      .filter(c => c.tipo === tipo)
      .filter(c => {
        const f = S.filtros;
        if (f.concepto    && !c.concepto.toLowerCase().includes(f.concepto.toLowerCase())) return false;
        if (f.moneda      && c.moneda !== f.moneda) return false;
        if (f.recurrencia && c.recurrencia !== f.recurrencia) return false;
        // Filtro por año+mes si hay mes activo
        if (S.mes > 0) {
          const d = new Date(c.fecha_vencimiento + 'T00:00:00');
          if (d.getFullYear() !== S.año || d.getMonth() + 1 !== S.mes) return false;
        }
        return true;
      });
    if (datos.length === 0) return _emptyState('No hay registros');
    return `
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
    `;
  }

  function _renderCuentas() {
    const tipo = S.tab;
    const titulo = tipo === 'cxc' ? 'Cuentas por cobrar' : 'Cuentas por pagar';
    const perfilNombre = PERFILES[S.perfil].nombre;
    const addClass = S.perfil === 'laboral' ? 'laboral-mode' : '';

    document.getElementById('main-content').innerHTML = `
      <div class="toolbar">
        <div class="toolbar-title">${titulo} · ${esc(perfilNombre)}</div>
        <button class="btn-sm btn-notify" onclick="CF.verificarNotificaciones()">🔔 Verificar alertas</button>
        <button class="btn-sm btn-export" onclick="CF.exportar('cuentas','${tipo}')">⬇ Excel</button>
        <button class="btn-sm btn-add ${addClass}" onclick="CF.openModal()">+ Agregar</button>
      </div>
      <div class="filters-row">
        <input id="filter-concepto" class="filter-input" placeholder="Buscar concepto…"
          value="${esc(S.filtros.concepto)}" oninput="CF._setFiltro('concepto', this.value)">
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
      <div id="data-area">${_buildCuentasData()}</div>
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
    const btnReg = c.registrado
      ? `<button class="btn-reg btn-reg-done" disabled>✓ ${c.tipo === 'cxc' ? 'Cobrado' : 'Pagado'}</button>`
      : c.tipo === 'cxc'
        ? `<button class="btn-reg btn-reg-cxc" onclick="CF.registrarMovimiento(${c.id})">✓ Cobrar</button>`
        : `<button class="btn-reg btn-reg-cxp" onclick="CF.registrarMovimiento(${c.id})">✓ Pagar</button>`;
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
            ${btnReg}
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
  function _buildLibroData() {
    // Base: transacciones del año (ya cargadas por API); adicionalmente filtra por mes si aplica
    const txBase = S.mes > 0
      ? S.transacciones.filter(t => new Date(t.fecha + 'T00:00:00').getMonth() + 1 === S.mes)
      : S.transacciones;

    const datos = txBase.filter(t => {
      const f = S.filtros;
      if (f.tipo_tx && t.tipo !== f.tipo_tx) return false;
      if (f.cat && String(t.categoria_id) !== String(f.cat)) return false;
      if (f.desc && !t.descripcion.toLowerCase().includes(f.desc.toLowerCase())) return false;
      return true;
    });

    const ingresos = txBase.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.valor, 0);
    const egresos  = txBase.filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.valor, 0);
    const saldo    = ingresos - egresos;

    let saldoAcum = 0;
    const datosConSaldo = datos.map(t => {
      saldoAcum += t.tipo === 'ingreso' ? t.valor : -t.valor;
      return { ...t, saldoAcum };
    });

    const resCat = {};
    txBase.forEach(t => {
      const nom = t.categoria?.nombre || 'Sin categoría';
      if (!resCat[nom]) resCat[nom] = { ing: 0, egr: 0 };
      if (t.tipo === 'ingreso') resCat[nom].ing += t.valor;
      else resCat[nom].egr += t.valor;
    });

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Categoría</th><th>Descripción</th>
              <th class="td-right col-ingreso-h">Ingreso</th>
              <th class="td-right col-egreso-h">Egreso</th>
              <th class="td-right">Saldo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${datos.length === 0
              ? `<tr><td colspan="7" class="empty-cell">📭 Sin movimientos — registra cobros y pagos desde CxC / CxP.</td></tr>`
              : datosConSaldo.map(t => _rowTransaccion(t)).join('')
            }
          </tbody>
          <tfoot>
            <tr class="libro-totales">
              <td colspan="3"><strong>Totales ${S.año}</strong></td>
              <td class="td-right td-mono col-ingreso"><strong>${ingresos ? fmtCOP(ingresos) : '—'}</strong></td>
              <td class="td-right td-mono col-egreso"><strong>${egresos  ? fmtCOP(egresos)  : '—'}</strong></td>
              <td class="td-right td-mono ${saldo >= 0 ? 'saldo-pos' : 'saldo-neg'}"><strong>${fmtCOP(saldo)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
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

  function _renderLibro() {
    const addClass = S.perfil === 'laboral' ? 'laboral-mode' : '';
    const catOpts = S.categorias.map(c =>
      `<option value="${c.id}" ${S.filtros.cat===String(c.id)?'selected':''}>${esc(c.nombre)}</option>`
    ).join('');

    document.getElementById('main-content').innerHTML = `
      <div class="toolbar">
        <div class="toolbar-title">Libro contable ${S.año} · ${esc(PERFILES[S.perfil].nombre)}</div>
        <button class="btn-sm btn-export" onclick="CF.exportar('libro')">⬇ Excel</button>
        <button class="btn-sm btn-add ${addClass}" onclick="CF.openCategoriasModal()">Categorías</button>
      </div>
      <div class="filters-row">
        <input id="filter-desc" class="filter-input" placeholder="Buscar descripción…"
          value="${esc(S.filtros.desc)}" oninput="CF._setFiltro('desc', this.value)">
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
      <div id="data-area">${_buildLibroData()}</div>
    `;
  }

  function _rowTransaccion(t) {
    const catNom = t.categoria?.nombre || 'Sin categoría';
    const esIngreso = t.tipo === 'ingreso';
    return `
      <tr>
        <td>${fmtDate(t.fecha)}</td>
        <td class="td-muted">${esc(catNom)}</td>
        <td>${esc(t.descripcion)}</td>
        <td class="td-right td-mono col-ingreso">${esIngreso ? fmtCOP(t.valor) : ''}</td>
        <td class="td-right td-mono col-egreso">${!esIngreso ? fmtCOP(t.valor) : ''}</td>
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

    // Solo mostrar categorías asignadas: excluir predefinidas no configuradas (ambos+ambas = default intacto)
    const catsFiltradas = S.categorias.filter(cat => {
      if (cat.perfil !== S.perfil && cat.perfil !== 'ambos') return false;
      if (cat.tipo !== S.tab && cat.tipo !== 'ambas') return false;
      if (cat.es_predefinida && cat.perfil === 'ambos' && cat.tipo === 'ambas') return false;
      return true;
    });
    const catChipsCuenta = catsFiltradas.map(cat => `
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
        <label class="form-label">Categoría
          <span style="font-weight:400;color:var(--text-muted)">(${catsFiltradas.length} — gestiona en <em>Libro &gt; Categorías</em>)</span>
        </label>
        <input type="hidden" id="f-categoria" value="${v('categoria_id') || ''}">
        <div class="cat-chips" id="cat-chips">
          <div class="cat-chip ${!v('categoria_id') ? 'cat-chip-sel' : ''}"
               onclick="CF._selCat(this,'')">Sin categoría</div>
          ${catChipsCuenta || '<span style="color:var(--text-muted);font-size:12px;padding:4px 0">Sin categorías asignadas — crea y asigna desde Libro › Categorías</span>'}
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
  // REGISTRAR PAGO / COBRO → LIBRO CONTABLE
  // ----------------------------------------------------------
  async function registrarMovimiento(id) {
    const cuenta = S.cuentas.find(c => c.id === id);
    if (!cuenta) return;
    S.editId = null;
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.onclick = e => { if (e.target === overlay) closeModal(); };
    try { await loadCategorias(); } catch (_) {}
    _renderFormRegistro(cuenta);
  }

  function _renderFormRegistro(cuenta) {
    const esCobro  = cuenta.tipo === 'cxc';
    const tipoTx   = esCobro ? 'ingreso' : 'egreso';
    const tipoLabel = esCobro ? 'Cobro' : 'Pago';
    const addClass  = cuenta.perfil === 'laboral' ? 'laboral-mode' : '';

    document.getElementById('modal-title').textContent = `Registrar ${tipoLabel} en libro contable`;

    // Solo categorías asignadas al perfil+tipo de la cuenta (excluir predefinidas sin configurar)
    const catsFiltReg = S.categorias.filter(c => {
      if (c.perfil !== cuenta.perfil && c.perfil !== 'ambos') return false;
      if (c.tipo !== cuenta.tipo && c.tipo !== 'ambas') return false;
      if (c.es_predefinida && c.perfil === 'ambos' && c.tipo === 'ambas') return false;
      return true;
    });
    const catChips = catsFiltReg.map(c => `
      <div class="cat-chip ${String(cuenta.categoria_id) === String(c.id) ? 'cat-chip-sel' : ''}"
           onclick="CF._selCat(this,'${c.id}')">${esc(c.nombre)}</div>
    `).join('');

    document.getElementById('modal-body').innerHTML = `
      <div class="reg-info-box reg-${tipoTx}">
        <span class="badge badge-${tipoTx}">${tipoLabel}</span>
        <strong>${esc(cuenta.concepto)}</strong>
        <span class="reg-info-valor">${fmtMoney(cuenta.valor, cuenta.moneda)}</span>
      </div>
      <div class="form-section-title">${esc(PERFILES[cuenta.perfil].nombre)}</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha del ${tipoLabel.toLowerCase()} *</label>
          <input id="f-fecha" type="date" class="form-control" value="${todayISO()}">
        </div>
        <div class="form-group">
          <label class="form-label">Valor *</label>
          <input id="f-valor" type="number" step="1" min="0" class="form-control" value="${cuenta.valor}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Categoría <span style="font-weight:400;color:var(--text-muted)">(${catsFiltReg.length} disponibles)</span></label>
        <input type="hidden" id="f-categoria" value="${cuenta.categoria_id || ''}">
        <div class="cat-chips" id="cat-chips">
          <div class="cat-chip ${!cuenta.categoria_id ? 'cat-chip-sel' : ''}" onclick="CF._selCat(this,'')">Sin categoría</div>
          ${catChips}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción *</label>
        <input id="f-desc" class="form-control" placeholder="¿De qué se trata?" value="${esc(cuenta.concepto)}">
      </div>
      <div class="form-actions">
        <button class="btn-cancel" onclick="CF.closeModal()">Cancelar</button>
        <button class="btn-save ${addClass}" onclick="CF.saveRegistroMovimiento('${cuenta.perfil}','${tipoTx}',${cuenta.id})">
          Registrar ${tipoLabel}
        </button>
      </div>
    `;
  }

  async function saveRegistroMovimiento(perfil, tipoTx, cuentaId) {
    const fecha = document.getElementById('f-fecha').value;
    const valor = parseFloat(document.getElementById('f-valor').value);
    const desc  = document.getElementById('f-desc').value.trim();
    const catId = (document.getElementById('f-categoria')?.value || '').trim();

    if (!fecha || !desc || isNaN(valor) || valor <= 0) {
      toast('Fecha, descripción y valor son obligatorios', 'err');
      return;
    }

    const payload = {
      perfil,
      categoria_id: catId ? parseInt(catId) : null,
      fecha,
      descripcion: desc,
      valor,
      tipo: tipoTx,
    };

    try {
      await api('POST', '/api/transacciones', payload);
      if (cuentaId) await api('PATCH', `/api/cuentas/${cuentaId}/registrar`);
      toast(`${tipoTx === 'ingreso' ? 'Cobro' : 'Pago'} registrado en el libro contable ✓`);
      closeModal();
      await Promise.all([loadCuentas(), loadTransacciones()]);
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
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
    const nombre = input?.value.trim();
    if (!nombre) return;

    // Perfil siempre es el activo; tipo depende del contexto
    const perfil = S.perfil;
    const tipo = S.tab === 'libro'
      ? (document.getElementById('f-cat-tipo')?.value || 'ambas')
      : S.tab;  // 'cxc' o 'cxp'

    try {
      await api('POST', '/api/categorias', { nombre, perfil, tipo });
      toast(`Categoría "${nombre}" creada`);
      if (input) input.value = '';
      await loadCategorias();
      if (S.tab === 'libro') {
        _renderFormCategorias();
      } else {
        _renderFormCuenta(S.editId);
      }
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
  // MODAL CATEGORÍAS (desde Libro contable)
  // ----------------------------------------------------------
  async function openCategoriasModal() {
    S.editId = null;
    S.catTabFiltro = '';
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.onclick = e => { if (e.target === overlay) closeModal(); };
    try { await loadCategorias(); } catch (_) {}
    _renderFormCategorias();
  }

  function _buildCatChips() {
    const cats = S.categorias.filter(c => {
      if (c.perfil !== S.perfil && c.perfil !== 'ambos') return false;
      if (S.catTabFiltro && c.tipo !== S.catTabFiltro && c.tipo !== 'ambas') return false;
      return true;
    });
    if (!cats.length) return '<span style="color:var(--text-muted);font-size:13px">Sin categorías para este contexto.</span>';

    const tipoLabel = { cxc: 'CxC', cxp: 'CxP', ambas: '↔' };
    const tipoCls   = { cxc: 'cat-badge-cxc', cxp: 'cat-badge-cxp', ambas: 'cat-badge-ambas' };

    return cats.map(c => {
      const nombreEsc  = esc(c.nombre).replace(/'/g, '&#39;');
      return `
        <div class="cat-chip cat-chip-mgr" id="cat-mgr-${c.id}"
             onclick="CF._iniciarRenameCat(${c.id},'${nombreEsc}','${c.tipo}','${c.perfil}')"
             title="Clic para editar">
          ${esc(c.nombre)}<span class="${tipoCls[c.tipo] || 'cat-badge-ambas'}">${tipoLabel[c.tipo] || '↔'}</span>
        </div>`;
    }).join('');
  }

  function _setCatTabFiltro(tipo) {
    S.catTabFiltro = tipo;
    const area = document.getElementById('cat-chips-mgr');
    if (area) area.innerHTML = _buildCatChips();
    document.querySelectorAll('.cat-filter-btn').forEach((b, i) => {
      const vals = ['', 'cxc', 'cxp'];
      b.classList.toggle('active', vals[i] === tipo);
    });
  }

  function _renderFormCategorias() {
    document.getElementById('modal-title').textContent = 'Categorías';
    const perfilLabel = S.perfil === 'laboral' ? 'Ok Web S.A.S.' : 'Personal';
    document.getElementById('modal-body').innerHTML = `
      <p class="form-label" style="margin-bottom:10px">
        Perfil activo: <strong>${perfilLabel}</strong> — cada perfil gestiona sus propias categorías.
      </p>
      <div class="cat-nueva" style="margin-bottom:14px">
        <input id="f-cat-nueva" class="form-control" placeholder="Nombre de la nueva categoría…">
        <select id="f-cat-tipo" class="form-control" style="width:auto;min-width:90px;flex-shrink:0">
          <option value="ambas">Ambas</option>
          <option value="cxc">CxC</option>
          <option value="cxp">CxP</option>
        </select>
        <button class="btn-cat-add" onclick="CF.crearCategoria()">Crear</button>
      </div>
      <div class="cat-filter-row">
        <button class="cat-filter-btn active" onclick="CF._setCatTabFiltro('')">Todas</button>
        <button class="cat-filter-btn" onclick="CF._setCatTabFiltro('cxc')">CxC</button>
        <button class="cat-filter-btn" onclick="CF._setCatTabFiltro('cxp')">CxP</button>
      </div>
      <p class="form-label" style="margin-bottom:8px;color:var(--text-muted)">
        Toca una categoría para renombrarla o cambiar su alcance:
      </p>
      <div class="cat-chips" id="cat-chips-mgr" style="max-height:260px">
        ${_buildCatChips()}
      </div>
      <div class="form-actions" style="margin-top:20px">
        <button class="btn-cancel" onclick="CF.closeModal()">Cerrar</button>
      </div>
    `;
  }

  function _iniciarRenameCat(id, nombre, tipo, perfil) {
    const chip = document.getElementById(`cat-mgr-${id}`);
    if (!chip) return;
    chip.onclick = null;
    chip.classList.add('cat-chip-sel');
    chip.style.flexDirection = 'column';
    chip.style.alignItems = 'flex-start';
    chip.style.gap = '6px';
    chip.innerHTML = `
      <input class="cat-rename-input" id="cat-rename-${id}" value="${nombre}"
             onclick="event.stopPropagation()"
             onkeydown="if(event.key==='Enter'){event.preventDefault();CF._guardarRenameCat(${id});}if(event.key==='Escape')CF._renderFormCategorias();">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <select id="cat-edit-tipo-${id}" onclick="event.stopPropagation()"
                style="font-size:11px;padding:2px 6px;border-radius:4px;border:1px solid var(--border)">
          <option value="ambas" ${tipo==='ambas'?'selected':''}>Ambas (CxC y CxP)</option>
          <option value="cxc"   ${tipo==='cxc'?'selected':''}>Solo CxC (cobros)</option>
          <option value="cxp"   ${tipo==='cxp'?'selected':''}>Solo CxP (pagos)</option>
        </select>
        <select id="cat-edit-perfil-${id}" onclick="event.stopPropagation()"
                style="font-size:11px;padding:2px 6px;border-radius:4px;border:1px solid var(--border)">
          <option value="ambos"    ${perfil==='ambos'?'selected':''}>Ambos perfiles</option>
          <option value="personal" ${perfil==='personal'?'selected':''}>Solo Personal</option>
          <option value="laboral"  ${perfil==='laboral'?'selected':''}>Solo Ok Web</option>
        </select>
        <button style="padding:2px 8px;font-size:11px;background:#fff;border-radius:4px;border:1px solid var(--border)"
                onclick="event.stopPropagation();CF._guardarRenameCat(${id})">✓ Guardar</button>
        <button style="padding:2px 8px;font-size:11px;background:#f1f5f9;border-radius:4px;border:1px solid var(--border)"
                onclick="event.stopPropagation();CF._renderFormCategorias()">✕</button>
      </div>
    `;
    const inp = document.getElementById(`cat-rename-${id}`);
    if (inp) { inp.focus(); inp.select(); }
  }

  async function _guardarRenameCat(id) {
    const nombre = document.getElementById(`cat-rename-${id}`)?.value.trim();
    const tipo   = document.getElementById(`cat-edit-tipo-${id}`)?.value   || 'ambas';
    const perfil = document.getElementById(`cat-edit-perfil-${id}`)?.value || 'ambos';
    if (!nombre) return;
    try {
      await api('PUT', `/api/categorias/${id}`, { nombre, tipo, perfil });
      toast('Categoría actualizada');
      await loadCategorias();
      _renderFormCategorias();
    } catch (e) {
      toast(e.message, 'err');
    }
  }

  // ----------------------------------------------------------
  // FILTROS
  // ----------------------------------------------------------
  function _setFiltro(key, val) {
    S.filtros[key] = val;
    // Solo actualizar la zona de datos — preserva el foco del input de búsqueda
    const dataArea = document.getElementById('data-area');
    if (dataArea) {
      dataArea.innerHTML = S.tab === 'libro' ? _buildLibroData() : _buildCuentasData();
    } else {
      _renderContent();
    }
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
    // ESC cierra el modal activo
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

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
    setPerfil, setTab, setAño, setMes, logout, openModal, closeModal,
    saveCuenta, deleteCuenta, saveTransaccion, deleteTransaccion,
    crearCategoria, verificarNotificaciones, exportar,
    _setFiltro, _limpiarFiltros, _selCat,
    registrarMovimiento, saveRegistroMovimiento,
    openCategoriasModal, _renderFormCategorias,
    _iniciarRenameCat, _guardarRenameCat, _setCatTabFiltro,
  };

})();
