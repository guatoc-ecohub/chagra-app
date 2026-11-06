/* eslint-disable chagra-i18n/no-hardcoded-spanish -- Copy del Home A publicado en español. */
/* Trusted, bundled document bridge. The opaque frame receives display data only. */
/** @template T @param {T} value @returns {{ channel: 'home-a-data', value: T }} */
export function createHomeDataMessage(value) {
  return { channel: 'home-a-data', value };
}

export function installHomeBridge() {
  const send = (action, value) => parent.postMessage({ channel: 'home-a', action, value }, '*');
  const text = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  };
  const entry = (title, detail, view) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'pendiente';
    button.type = 'button';
    button.dataset.v = view;
    const span = document.createElement('span');
    const strong = document.createElement('b');
    strong.textContent = title;
    const description = document.createElement('span');
    description.className = 'd';
    description.textContent = detail;
    span.append(strong, description);
    button.append(span);
    li.append(button);
    return li;
  };
  const summaryRow = (item, className = '') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `home-data-row ${className}`.trim();
    button.dataset.v = item.view;
    button.setAttribute('aria-label', `${item.label}, ${item.count}`);
    const name = document.createElement('span'); name.textContent = item.label;
    const count = document.createElement('b'); count.textContent = String(item.count);
    button.append(name, count);
    return button;
  };
  const renderFarmSummary = (region, content) => {
    const counts = document.createElement('div'); counts.className = 'home-data-counts';
    content.counts.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'home-data-count'; button.dataset.v = item.view;
      button.setAttribute('aria-label', `${item.count} ${item.label}, abrir`);
      const value = document.createElement('b'); value.textContent = String(item.count);
      const label = document.createElement('span'); label.textContent = item.label;
      button.append(value, label); counts.append(button);
    });
    const lists = document.createElement('div'); lists.className = 'home-data-lists';
    for (const [heading, items, total, view] of [
      ['Sus plantas', content.plants, content.plantTotal, 'plantas-v2'],
      ['Sus zonas', content.lands, content.landTotal, 'puerta_zonas'],
    ]) {
      const section = document.createElement('section'); section.className = 'home-data-list';
      const title = document.createElement('h3'); title.textContent = heading; section.append(title);
      if (!total) {
        const empty = document.createElement('p'); empty.className = 'home-data-empty'; empty.textContent = heading === 'Sus plantas' ? 'Aún no hay plantas registradas.' : 'Aún no hay zonas registradas.'; section.append(empty);
      } else {
        const rows = document.createElement('div'); rows.className = 'home-data-rows';
        items.forEach(item => rows.append(summaryRow(item)));
        section.append(rows);
        if (total > items.length) {
          const more = document.createElement('button'); more.type = 'button'; more.className = 'home-data-more'; more.dataset.v = view;
          more.textContent = `Ver las ${total} →`; section.append(more);
        }
      }
      lists.append(section);
    }
    region.replaceChildren(counts, lists);
  };
  const renderMaterialsSummary = (region, content) => {
    const heading = document.createElement('h3'); heading.className = 'home-data-heading';
    heading.textContent = content.total ? `${content.total} materiales en bodega` : 'Bodega';
    const rows = document.createElement('div'); rows.className = 'home-data-rows';
    if (content.total) content.items.forEach(item => rows.append(summaryRow(item)));
    else {
      const empty = document.createElement('p'); empty.className = 'home-data-empty'; empty.textContent = 'Aún no hay materiales registrados.'; rows.append(empty);
    }
    const children = document.createDocumentFragment();
    children.append(heading, rows);
    if (content.total > content.items.length) {
      const more = document.createElement('button'); more.type = 'button'; more.className = 'home-data-more'; more.dataset.v = 'bodega'; more.textContent = `Ver los ${content.total} →`; children.append(more);
    }
    region.replaceChildren(children);
  };
  const renderActivitySummary = (region, content) => {
    const children = document.createDocumentFragment();
    const heading = document.createElement('h3'); heading.className = 'home-data-heading'; heading.textContent = content.label;
    children.append(heading);
    if (!content.available) {
      const empty = document.createElement('p'); empty.className = 'home-data-empty';
      empty.textContent = 'Vuelva a intentarlo cuando los registros estén disponibles.'; children.append(empty);
    } else {
      const noun = content.label === 'Siembras' ? (content.total === 1 ? 'siembra' : 'siembras') : (content.total === 1 ? 'cosecha' : 'cosechas');
      children.append(summaryRow({ label: `${content.total} ${noun} registradas`, count: 'Abrir', view: content.view }));
    }
    if (content.available && !content.total) {
      const empty = document.createElement('p'); empty.className = 'home-data-empty'; empty.textContent = content.empty; children.append(empty);
      const action = document.createElement('button'); action.type = 'button'; action.className = 'home-data-more'; action.dataset.v = content.emptyView || content.view;
      action.textContent = `${content.emptyAction} →`; children.append(action);
    } else if (content.available) {
      const rows = document.createElement('div'); rows.className = 'home-data-rows';
      content.items.forEach(item => {
        const detail = [item.date, item.quantity, item.state].filter(Boolean).join(' · ');
        rows.append(summaryRow({ label: item.label, count: detail, view: content.view }));
      });
      children.append(rows);
      if (content.total > content.items.length) {
        const more = document.createElement('button'); more.type = 'button'; more.className = 'home-data-more'; more.dataset.v = content.view;
        more.textContent = `Ver las ${content.total} →`; children.append(more);
      }
    }
    region.replaceChildren(children);
  };
  const renderCountsSummary = (region, content) => {
    const counts = document.createElement('div'); counts.className = 'home-data-counts';
    content.counts.forEach(item => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'home-data-count'; button.dataset.v = item.view;
      button.setAttribute('aria-label', item.count == null ? `${item.label}, no se pudo consultar` : `${item.count} ${item.label}, abrir`);
      const value = document.createElement('b'); value.textContent = item.count == null ? '…' : String(item.count);
      const label = document.createElement('span'); label.textContent = item.label;
      button.append(value, label); counts.append(button);
    });
    region.replaceChildren(counts);
  };
  const renderAccountSummary = (region, content) => {
    const rows = document.createElement('div'); rows.className = 'home-data-rows';
    const sync = content.pending == null
      ? { label: 'No se pudo consultar la sincronización', count: 'Revisar', view: 'bitacora' }
      : { label: 'Registros pendientes por subir', count: content.pending, view: 'bitacora' };
    rows.append(summaryRow(sync));
    rows.append(summaryRow({ label: content.profileName ? `Perfil: ${content.profileName}` : 'Complete su perfil para personalizar la finca', count: content.profileName ? 'Abrir' : 'Completar', view: 'perfil' }));
    region.replaceChildren(rows);
  };
  addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.channel !== 'home-a-data') return;
    const d = event.data.value;
    if (!d) return;
    dispatchEvent(new CustomEvent('home-data', { detail: d }));
    text('.ubicar span', d.location || 'Ubicar mi finca');
    document.querySelector('.ubicar')?.setAttribute('aria-label', d.location || 'Ubicar mi finca');
    text('.pendientes .txt', d.pending == null ? 'Cola sin consultar' : `${d.pending} por subir`);
    document.querySelector('.tablero .pendientes')?.setAttribute('aria-label', d.pending == null ? 'Cola sin consultar' : `${d.pending} pendientes por subir`);
    text('#clima', d.weather);
    const days = document.querySelector('#siete');
    if (days) {
      days.replaceChildren(...d.forecast.map(day => {
        const span = document.createElement('span');
        span.textContent = day;
        return span;
      }));
    }
    const months = document.querySelector('#meses');
    if (months) {
      text('.anio-cab h3', 'Cosechas del año');
      text('.anio-pie', 'Número de cosechas anotadas por mes.');
      text('#anio-ahora', String(d.year));
      months.setAttribute('aria-label', 'Cosechas registradas por mes');
      if (d.months) {
        const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        months.replaceChildren(...d.months.map((count, index) => {
          const month = document.createElement('div'); month.className = 'mes';
          month.setAttribute('aria-label', `${labels[index]}: ${count} cosechas`);
          const bar = document.createElement('i');
          bar.style.height = `${count / Math.max(1, ...d.months) * 52}px`;
          const label = document.createElement('span'); label.textContent = labels[index];
          month.append(bar, label); return month;
        }));
      } else months.textContent = 'No se pudieron consultar las cosechas.';
    }
    const tasks = document.querySelector('#pendientes');
    if (tasks) {
      const taskEntries = d.tasks.slice(0, 4).map(task => entry(task.title, task.deadline, 'task_log'));
      if (d.tasks.length > taskEntries.length) taskEntries.push(entry('Ver todas →', `${d.tasks.length} tareas pendientes`, 'task_log'));
      if (d.tasksAvailable && !d.tasks.length) taskEntries.push(entry('Agendar una labor', 'Añada una tarea para hoy o para más adelante.', 'new_task'));
      tasks.replaceChildren(...taskEntries);
      const note = document.querySelector('.nota-ejemplo');
      if (note) {
        note.replaceChildren();
        if (!d.tasksAvailable) note.textContent = 'No se pudieron consultar las tareas guardadas.';
        else note.textContent = d.tasks.length ? 'Tareas guardadas en su finca.' : 'No hay tareas pendientes guardadas.';
      }
      if (d.locationConfirmed !== false) tasks.prepend(entry('El tiempo de su finca', d.weather, d.weatherView || 'clima_boletin'));
      const weatherButton = document.querySelector('#a-un-toque [data-v="clima_boletin"], #a-un-toque [data-home-weather]');
      if (weatherButton instanceof HTMLButtonElement) {
        weatherButton.dataset.homeWeather = '';
        weatherButton.dataset.v = d.weatherView || 'clima_boletin';
      }
      tasks.prepend(entry(`${d.tasksAvailable ? d.tasks.length : 'Tareas'} pendientes`, d.tasksAvailable ? 'Abrir la lista de tareas' : 'No se pudieron consultar', 'task_log'));
    }
    for (const [group, content] of Object.entries(d.groups)) {
      const container = document.querySelector(`#g-${group} .grupo-cuerpo`);
      if (!container) continue;
      let region = container.querySelector('.home-data');
      if (!region) {
        region = document.createElement('div');
        region.className = 'home-data';
        region.setAttribute('aria-label', 'Registros de su finca');
        container.prepend(region);
      }
      if (!Array.isArray(content) && content.type === 'farm') {
        renderFarmSummary(region, content);
        continue;
      }
      if (!Array.isArray(content) && content.type === 'materials') {
        renderMaterialsSummary(region, content);
        continue;
      }
      if (!Array.isArray(content) && content.type === 'activity') {
        renderActivitySummary(region, content);
        continue;
      }
      if (!Array.isArray(content) && content.type === 'counts') {
        renderCountsSummary(region, content);
        continue;
      }
      if (!Array.isArray(content) && content.type === 'account') {
        renderAccountSummary(region, content);
        continue;
      }
      region.replaceChildren(...content.map(line => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
      }));
    }
    for (const button of document.querySelectorAll('[data-v]')) {
      if (!(button instanceof HTMLButtonElement)) continue;
      if (!d.views.includes(button.dataset.v)) {
        button.disabled = true;
        button.title = 'Esta función todavía no está disponible en la app';
      }
    }
    const directory = /** @type {any} */ (window).__home;
    if (directory) send('directory', [...directory.POR_VISTA.values()].map(tool => ({view:tool.v, title:tool.t, description:tool.d, keywords:tool.k || '', searchTerms:tool.searchTerms || []})));
    if (d.group && document.body.dataset.group !== String(d.group)) {
      document.body.dataset.group = String(d.group);
      requestAnimationFrame(() => {
        const section = document.getElementById(`g-${d.group}`);
        section?.scrollIntoView({ block: 'start', behavior: 'instant' });
        const heading = section?.querySelector('h2');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus({ preventScroll: true });
      });
    }
  });
  // Welcome tour: the parent asks for the box of a known section by key.
  addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.channel !== 'home-a-recorrido') return;
    const { action, key, id } = event.data;
    if (action === 'recorrido-percha') {
      document.body.dataset.perchaPestanas = event.data.activo ? 'si' : '';
      requestAnimationFrame(() => send('recorrido-percha', { id, activo: event.data.activo === true }));
      return;
    }
    if (action === 'recorrido-obstaculos') {
      send('recorrido-obstaculos', { id, rects: recorridoObstaculos(key) });
      return;
    }
    if (action && action !== 'recorrido-rect') return;
    const selector = recorridoSelector(key);
    send('recorrido-rect', { key, id, rect: selector ? unionRect(document.querySelectorAll(selector)) : null });
  });
  document.querySelector('[data-home-back]')?.addEventListener('click', () => send('home'));
  send('ready');
}

/**
 * Sections of the A and B documents that the welcome tour may point at. A
 * function, not a constant: the frame build only strips `export function`.
 * @param {unknown} key
 */
export function recorridoSelector(key) {
  const selectors = {
    escena: '#letreros',
    botones: '.redondo[data-lugar]',
    ayuda: '.redondo[data-lugar="ayuda"]',
    hableme: '.tablero',
    hoy: '#percha-hoy',
    atajos: '#a-un-toque',
    anio: 'details.anio',
    pestanas: '#trocha',
    plegables: '#g-2 > summary',
    muelle: '.muelle button.hablar',
  };
  return typeof key === 'string' && Object.hasOwn(selectors, key) ? selectors[key] : null;
}

/** @param {ArrayLike<Element>} nodes */
export function unionRect(nodes) {
  let box = null;
  for (const node of Array.from(nodes)) {
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    box = box
      ? { top: Math.min(box.top, r.top), left: Math.min(box.left, r.left), bottom: Math.max(box.bottom, r.bottom), right: Math.max(box.right, r.right) }
      : { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
  }
  return box && { top: box.top, left: box.left, width: box.right - box.left, height: box.bottom - box.top };
}

/** Rectángulos de texto y controles visibles para colocar la guía sin cubrirlos. */
function recorridoObstaculos(key = null) {
  const controles = 'button,a,input,select,textarea,[role="button"],summary,label';
  const rectangulo = (rect, tipo) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, tipo });
  const rects = [];
  const selector = recorridoSelector(key);
  const objetivos = selector ? [...document.querySelectorAll(selector)] : [];
  const esObjetivo = node => objetivos.some(objetivo => objetivo === node || objetivo.contains(node));
  for (const node of document.querySelectorAll(controles)) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width && rect.height) rects.push({ ...rectangulo(rect, node.matches('input,select,textarea') ? 'control-fijo' : 'control'), objetivo: esObjetivo(node) });
  }

  // Use glyph bounds for copy. Paragraph and card boxes include large empty
  // areas that would rule out every nearby perch despite containing no text.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    if (!textNode.nodeValue?.trim()) continue;
    let visible = true;
    for (let node = textNode.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        visible = false;
        break;
      }
    }
    if (!visible) continue;
    const range = document.createRange();
    range.selectNodeContents(textNode);
    for (const rect of range.getClientRects()) {
      if (rect.width && rect.height) rects.push({ ...rectangulo(rect, 'texto'), objetivo: esObjetivo(textNode.parentElement) });
    }
    range.detach();
  }
  return rects;
}

// The written-chat recovery starts with a voice tap, before the illustration boots.
export function installHomeVoiceEntry() {
  const listen = event => {
    const target=event.target.closest?.('[data-lugar="agente"]');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    parent.postMessage({channel:'home-a',action:'listen'}, '*');
  };
  document.addEventListener('click',listen,true);
  return () => document.removeEventListener('click',listen,true);
}
