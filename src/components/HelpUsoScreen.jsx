/* eslint-disable chagra-i18n/no-hardcoded-spanish -- deuda i18n preexistente: copy del Manual, migración a messages.js aparte */
import React, { useState } from 'react';
import {
  ArrowLeft, ChevronDown, ChevronRight, Sprout, MapPin, Bug, Apple,
  MessageCircle, Wrench, Mic, CalendarDays, Leaf, Store,
} from 'lucide-react';
import FieldFeedback from './FieldFeedback';
import { IlusFoto, IlusMundos } from './help/HelpIllustrations.jsx';
import { CursoEntryCard } from './curso/CursoChagra.jsx';

/**
 * Sub-vista del Manual: cómo usar Chagra (FAQs reorganizadas).
 *
 * Reorganización 2026-05-08: temas en lugar de secciones planas. Tono "tú"
 * cercano (P1). "Reportar bug" dentro de FAQs (no cuarto botón). "Field test
 * cases" + "Novedades" salieron del Manual público (docs internos + CHANGELOG).
 *
 * Actualización ola 1.1.0 (2026-06-25): la app se reorganizó en cuatro
 * lugares (Gestionar/Aprender/Jugar/Agente) y estrenó registro por voz
 * unificado, directorio de especies, calendario de finca y mercado. Este
 * tema ahora orienta primero (los cuatro lugares) y agrega esas pantallas.
 * Consistente con el FAQ groundeado (src/data/faqChagra.json, #1856) y con
 * "Sobre el agente Chagra" (HelpAgentSection).
 */

// eslint-disable-next-line no-unused-vars -- Icon SE USA en JSX, eslint react-jsx detection falla con destructuring rename
const Section = ({ icon: Icon, title, children, defaultOpen = false, isNew = false, action = null }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border rounded-xl bg-slate-900/60 overflow-hidden transition-all ${isNew ? 'border-emerald-700/60 shadow-[0_0_18px_rgba(16,185,129,0.18)]' : 'border-slate-800'}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full p-3 flex items-center gap-3 hover:bg-slate-800/60 active:bg-slate-800 text-left min-h-[56px]"
      >
        <span className={`shrink-0 inline-flex items-center justify-center ${open ? 'motion-safe:animate-pulse' : ''}`}>
          <Icon size={20} className="text-emerald-400" />
        </span>
        <span className="text-base font-bold text-white flex-1">{title}</span>
        {isNew && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-600/40 motion-safe:animate-pulse">
            ✨ NUEVO
          </span>
        )}
        {open ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-sm text-slate-300 leading-relaxed space-y-2">
          {children}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/35 text-emerald-300 hover:text-emerald-100 border border-emerald-700/50 font-bold text-sm transition-colors min-h-[44px]"
            >
              {action.label} <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default function HelpUsoScreen({ onBackToHome, onNavigate }) {
  // Helper que cierra el manual y navega al flow real (CTA híbrida).
  const quickAction = (label, route) => ({
    label,
    onClick: () => {
      if (typeof onNavigate === 'function') onNavigate(route);
    },
  });

  // Si hay 0 plantas activas, abrir "Inicio rápido" por default. Si ya tiene
  // plantas, todo cerrado para no abrumar (P2 anti-ladrillo).
  // Sin acceso al store aquí — usamos defaultOpen=false simple, el operador
  // expande lo que necesite. Si queremos heurística first-time user en el
  // futuro, pasar `plantsCount` como prop.

  return (
    <div className="h-full w-full flex flex-col">
      {/* Sub-header con back to home del Manual */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 shrink-0 border-b border-slate-800/60 bg-slate-950/60">
        <button
          type="button"
          onClick={onBackToHome}
          aria-label="Volver al Manual"
          className="p-2 -ml-2 rounded-lg active:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <ArrowLeft size={20} className="text-amber-400" />
        </button>
        <p className="text-xs uppercase tracking-wider text-amber-400/80 font-bold">Manual</p>
        <ChevronRight size={14} className="text-slate-600" />
        <p className="text-xs font-bold text-amber-200">Cómo usar Chagra</p>
      </div>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full pb-12 flex flex-col gap-3">
        <p className="text-sm text-slate-300 leading-relaxed">
          Toque cada tema para abrir o cerrar. Si algo no está aquí, use el tema &ldquo;Reportar problema&rdquo; al final.
        </p>

        {/* ¿Primera vez? El curso guiado (video + lección + probar) lleva de la
            mano del primer registro a la venta. Va arriba de todo: es el mejor
            punto de partida para volverse autónomo con la app. */}
        {typeof onNavigate === 'function' && (
          <CursoEntryCard onNavigate={onNavigate} />
        )}

        {/* 0. Orientación — los cuatro lugares de Chagra (home F2). Esto va
            primero porque es el mapa mental que el campesino nuevo necesita
            para no perderse. Mismos nombres que los portales del inicio. */}
        <Section icon={IlusMundos} title="🧭 Los cuatro lugares de Chagra" defaultOpen>
          <p>
            Al abrir Chagra ve <strong className="text-emerald-200">su finca dibujada</strong> (la pantalla de inicio). Ahí toque uno de estos cuatro lugares:
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <strong className="text-emerald-300">🌱 Mi finca (Gestionar)</strong> — registrar y cuidar sus siembras, zonas, animales y la bitácora. También vender su cosecha.
            </li>
            <li>
              <strong className="text-amber-300">📚 Aprender</strong> — lecciones de agroecología con fuente: suelo vivo, milpa, biopreparados, MIP, fenología.
            </li>
            <li>
              <strong className="text-pink-300">🎮 Jugar</strong> — haga crecer su finca y defiéndala jugando (Mi Finca Viva).
            </li>
            <li>
              <strong className="text-sky-300">💬 Agente</strong> — pregúntele lo que sea por texto, voz o foto. Responde con su fuente. Mire el tema &ldquo;Sobre el agente Chagra&rdquo; en el Manual.
            </li>
          </ul>
          <p className="text-xs text-slate-400 italic mt-2">
            Para volver al inicio en cualquier momento, toque el ícono de la casa o la mano de Chagra arriba.
          </p>
        </Section>

        {/* 1. Inicio rápido */}
        <Section icon={Sprout} title="🌱 Inicio rápido (primera vez)" action={quickAction('Crear primera planta', 'plant_asset')}>
          <ol className="list-decimal pl-5 space-y-1.5">
            {/* Corrección 2026-07: el botón "+" del header ya no existe
                (UX-27 #286 lo reemplazó por el botón unificado mic+planta). */}
            <li>Toque el botón del <strong className="text-purple-400">micrófono con la plantica</strong> arriba (header) y diga lo que sembró, o cree la planta a mano con el botón de abajo.</li>
            <li>Busque la especie escribiendo (ej. &ldquo;gulpa&rdquo; encuentra Gulupa). Chagra autocompleta estrato, gremio y producción.</li>
            <li>Si tiene foto, súbala desde la cámara o galería.</li>
            <li>Marque la ubicación: toque mapa o &ldquo;Mi ubicación&rdquo;.</li>
            <li>Guarde. Aparece en <strong>Activos → Plantas</strong>.</li>
          </ol>
          <div className="mt-3 p-3 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
            <p className="text-[11px] font-bold text-emerald-300 uppercase mb-1">Por qué a veces crea N plantas y a veces 1</p>
            <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4 leading-relaxed">
              <li><strong className="text-emerald-300">Individual</strong>: frutales, café, plátano, aromáticas, tubérculos. Cada planta merece hoja de vida propia.</li>
              <li><strong className="text-amber-300">Agregado</strong>: hortalizas en cama, cereales, abonos verdes. Se manejan por conjunto.</li>
            </ul>
            <p className="text-[11px] text-slate-400 italic mt-2">En el formulario aparece &ldquo;Agrupar siembra&rdquo; o &ldquo;Registrar individualmente&rdquo; si quiere cambiar el default.</p>
          </div>
          <p className="text-xs text-slate-500 italic mt-2">
            ¿Sin red? La app funciona offline. Sus datos se sincronizan cuando vuelva la conexión.
          </p>
        </Section>

        {/* 2. Foto + IA */}
        <Section icon={IlusFoto} title="📸 Foto + IA por foto" action={quickAction('Crear planta con foto', 'plant_asset')}>
          <p><strong>Al crear planta:</strong> el botón cámara abre su cámara o galería. La foto queda en la hoja de vida de esa planta.</p>
          <p><strong>Adjuntar a evento existente</strong>: entre al evento desde Bitácora → sección &ldquo;Adjuntar foto a este evento&rdquo;. Útil para documentar después.</p>

          <div className="mt-3 p-3 rounded-lg bg-emerald-900/15 border border-emerald-800/30">
            <p className="text-emerald-300 font-bold text-sm mb-1">🌱 Foto guía por especie</p>
            <ul className="text-xs text-slate-300 list-disc pl-5 space-y-1 leading-relaxed">
              <li>Su primera foto de cada especie queda como referencia visual cada vez que abra el formulario de esa especie.</li>
              <li>Si todavía no ha tomado una foto, verá un marcador verde con &ldquo;Agregue una foto&rdquo;. No es un error: es una invitación.</li>
              <li>Las fotos NO se comparten con otras fincas (privacidad). Solo usted las ve en su cuenta.</li>
              <li>Las fotos se comprimen automáticamente a JPEG ≤500KB para no saturar el almacenamiento de su dispositivo.</li>
            </ul>
          </div>

          <div className="mt-3 p-3 rounded-lg bg-amber-900/15 border border-amber-800/30">
            <p className="text-amber-300 font-bold text-sm mb-1">🧬 IA por foto (PRUEBA)</p>
            <p className="text-xs text-slate-300 leading-relaxed">Dos funciones, ambas marcadas <strong className="text-amber-300">PRUEBA</strong>:</p>
            <ul className="text-xs text-slate-300 list-disc pl-5 space-y-1 mt-2 leading-relaxed">
              <li><strong>Diagnóstico de enfermedades</strong>: en Bitácora → entrada con foto → botón &ldquo;Analizar foto con IA&rdquo;. Detecta enfermedades, deficiencias, score de salud.</li>
              <li><strong>Identificar especie por foto</strong>: en SpeciesSelect → cámara. IA propone especie + alternativas. Confianza ≥70% auto-selecciona.</li>
              <li>Si el modelo local no responde, use <strong>Consultar IA externa</strong> en plant detail (genera prompt para Gemini/ChatGPT/Claude).</li>
            </ul>
            <p className="text-[11px] text-slate-400 italic mt-2">
              Necesita internet. Si no se conecta, le muestra opciones para reintentar.
            </p>
          </div>
        </Section>

        {/* 3. Zonas y ubicación */}
        <Section icon={MapPin} title="📍 Zonas y ubicación" action={quickAction('Ver mapa de la finca', 'mapa')}>
          <p>Sus plantas viven dentro de <strong>zonas</strong> (parcelas, camas, invernaderos). Antes de plantar muchas, cree las zonas:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Activos → tab <strong>&ldquo;Zonas&rdquo;</strong> (icono mapa) → +</li>
            <li>Nombre (ej. &ldquo;Casa los Sitios&rdquo;) + tipo (parcela / cama / invernadero)</li>
            <li>Defina el polígono en el mapa o capture un punto GPS</li>
          </ol>
          <p>Después, al crear plantas, seleccione esa zona como contenedor.</p>
            <p className="text-xs text-slate-500 italic mt-2">
              <strong>Brave + GPS</strong>: si el mapa muestra su ubicación incorrectamente, el navegador podría estar bloqueando el acceso preciso a su ubicación. Para solucionarlo, toque el icono del escudo en la barra de direcciones del navegador y desactive la opción de bloqueo de huellas digitales para este sitio.
            </p>
        </Section>

        {/* 4. Plagas y cosechas */}
        <Section icon={Bug} title="🐛 Plagas y 🍎 cosecha">
          <p className="font-bold text-emerald-200">Reportar plaga / invasora</p>
          <p>En el lugar <strong className="text-emerald-300">Gestionar</strong> toque <strong>&ldquo;Reportar plaga&rdquo;</strong>. Seleccione la especie del catálogo, capture foto y ubicación.</p>
          <p>Después de guardar le aparece una pantalla con <strong>sugerencias de especies nativas para reemplazar</strong>. Toque &ldquo;Sembrar aquí&rdquo; y va al registro de siembra ya cargado con la nativa + las coordenadas.</p>
          <p className="text-xs text-slate-400 mt-1">¿No sabe cómo controlarla sin químicos? Pregúntele al <strong className="text-sky-300">Agente</strong>: le sugiere control biológico y biopreparados con su fuente.</p>

          <p className="font-bold text-emerald-200 mt-3">Registrar cosecha</p>
          <p>En <strong className="text-emerald-300">Gestionar</strong> → sus plantas → seleccione la planta → &ldquo;Registrar cosecha&rdquo;. Anote cuánto cosechó (kg / unidades) + fecha. Queda en la hoja de vida de la planta.</p>
          <p>También por voz: diga &ldquo;coseché 5 kilos de gulupas&rdquo; con el botón micrófono. Ver el tema &ldquo;Cómo usar la voz&rdquo;.</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={quickAction('Reportar plaga', 'reportar_invasora').onClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-700/50 font-bold text-xs min-h-[40px]"
            >
              <Bug size={14} /> Reportar plaga
            </button>
            <button
              type="button"
              onClick={quickAction('Registrar cosecha', 'cosechar').onClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-700/50 font-bold text-xs min-h-[40px]"
            >
              <Apple size={14} /> Registrar cosecha
            </button>
          </div>
        </Section>

        {/* 5. Registrar por voz — atajo al tema completo + tipos. */}
        <Section icon={Mic} title="🎤 Registrar por voz (con las manos sucias)" action={quickAction('Probar la voz', 'voz')}>
          <p>La forma más rápida en campo. Toque el micrófono, hable normal y Chagra entiende y le deja confirmar antes de guardar.</p>
          <p className="mt-1">Con la voz puede registrar:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li><strong className="text-emerald-200">Sembrar</strong>: &ldquo;sembré 5 tomates en el invernadero&rdquo;.</li>
            <li><strong className="text-emerald-200">Cosechar</strong>: &ldquo;coseché 3 kilos de gulupas&rdquo;.</li>
            <li><strong className="text-emerald-200">Insumo</strong>: &ldquo;apliqué bocashi al tomate de ayer&rdquo;.</li>
            <li><strong className="text-emerald-200">Mantenimiento</strong>: &ldquo;podé el aguacate&rdquo;.</li>
            <li><strong className="text-emerald-200">Observación</strong>: &ldquo;vi una broca en el café&rdquo;.</li>
          </ul>
          <p className="text-xs text-slate-400 italic mt-2">El tema completo, paso a paso, está en el Manual → &ldquo;Cómo usar la voz&rdquo;.</p>
        </Section>

        {/* 6. Directorio de especies — pantalla nueva (#1855). */}
        <Section icon={Leaf} title="🌿 Buscar una especie (directorio)" action={quickAction('Abrir directorio de especies', 'especies')} isNew>
          <p>El <strong className="text-emerald-200">Directorio de especies</strong> es el catálogo de Chagra como fichas. Busque una planta y mire:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>en qué <strong>piso térmico / altitud</strong> prospera,</li>
            <li>con qué se lleva bien y qué evitar (<strong>asociaciones</strong>),</li>
            <li>qué <strong>plagas</strong> la afectan y quién las controla,</li>
            <li>qué <strong>biopreparados</strong> le sirven.</li>
          </ul>
          <p className="text-xs text-slate-400 italic mt-2">Si quiere preguntar en palabras (&ldquo;¿qué va con el café?&rdquo;), use el Agente.</p>
        </Section>

        {/* 7. Calendario de finca — pantalla nueva (#1853). */}
        <Section icon={CalendarDays} title="📅 Calendario de finca" action={quickAction('Abrir calendario', 'calendario')} isNew>
          <p>El <strong className="text-emerald-200">Calendario de finca</strong> reúne en un solo lugar cuándo <strong>sembrar, abonar, cuidar de plagas y cosechar</strong>, según su altitud y sus cultivos.</p>
          <p className="mt-1">Junta la fenología, la nutrición, la siembra/cosecha, el manejo de plagas (MIP) y los cultivos perennes. Así sabe qué toca este mes sin tener que adivinar.</p>
        </Section>

        {/* 8. Vender / Mercado — pantalla nueva (#1854). */}
        <Section icon={Store} title="🛒 Vender mi cosecha (mercado)" action={quickAction('Abrir el mercado de la finca', 'mercados')} isNew>
          <p>En el <strong className="text-emerald-200">Mercado de la finca</strong> publica lo que produce y lo vende por <strong>circuitos cortos</strong> (de su finca a quien come), coordinando por WhatsApp.</p>
          {/* Corrección 2026-07: el chip «Precio» del chat ya consulta la
              referencia mayorista real (SIPSA/DANE) desde 2026-07-01. */}
          <p className="text-xs text-slate-400 italic mt-2">El precio lo pone usted. Si quiere una referencia mayorista del día (SIPSA/DANE), pregúntele al Agente con el chip «Precio»: se la cita solo si hay fuente.</p>
        </Section>

        {/* 9. Reportar problema / sugerir mejora — embed del FieldFeedback
            form. Antes vivía como FAB flotante 💬 global; movido aquí
            2026-05-21 por feedback usuario (más discoverable + no tapa
            contenido). isNew=true para resaltar la nueva ubicación. */}
        <Section
          icon={MessageCircle}
          title="💬 Reportar problema con Chagra"
          isNew
          defaultOpen
        >
          <div className="bg-slate-950/50 border border-cyan-800/40 rounded-lg p-4">
            <FieldFeedback embedded />
          </div>
        </Section>

        {/* 6. Problemas comunes */}
        <Section icon={Wrench} title="🔧 Problemas comunes">
          <div className="space-y-3">
            <div>
              <p className="font-bold text-amber-300">📍 GPS no encuentra mi ubicación</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-2">
                El mapa centra automático al abrir el modal. Si tarda más
                de 15s o cae en error, toque &ldquo;Reintentar&rdquo;.
              </p>
              <details className="text-xs text-slate-400 leading-relaxed">
                <summary className="cursor-pointer text-cyan-400 hover:text-cyan-300 font-bold mb-1">
                  📱 En iPhone (iOS Safari)
                </summary>
                <ol className="list-decimal pl-5 space-y-1 mt-1">
                  <li>
                    Ajustes (la app del engranaje gris) → busque &ldquo;Safari&rdquo;
                    en la lista de apps → entre ahí.
                  </li>
                  <li>
                    Baje hasta encontrar <strong>&ldquo;Ubicación&rdquo;</strong> y
                    toque. Si dice &ldquo;Denegar&rdquo;, cámbielo a
                    &ldquo;Preguntar&rdquo; o &ldquo;Permitir&rdquo;.
                  </li>
                  <li>
                    Vuelva a Ajustes → &ldquo;Privacidad y seguridad&rdquo; →
                    &ldquo;Localización&rdquo; → confirme que la
                    <strong> localización general esté activada</strong> (al
                    principio de la pantalla).
                  </li>
                  <li>
                    Vuelva a Chagra, recargue la página (cierre la pestaña en
                    Safari y vuelva a entrar), y acepte el popup de permiso
                    cuando aparezca.
                  </li>
                </ol>
                <p className="mt-2 text-slate-500 italic">
                  Si instaló Chagra como app desde &ldquo;Añadir a pantalla
                  de inicio&rdquo;, la primera vez le va a preguntar de nuevo
                  el permiso — es esperado, acepte.
                </p>
              </details>
              <details className="text-xs text-slate-400 leading-relaxed mt-2">
                <summary className="cursor-pointer text-cyan-400 hover:text-cyan-300 font-bold mb-1">
                  🤖 En Android (Chrome o Brave)
                </summary>
                <ol className="list-decimal pl-5 space-y-1 mt-1">
                  <li>
                    En Chrome: barra de URL → ícono del candado o tres
                    puntos → &ldquo;Configuración del sitio&rdquo; o
                    &ldquo;Permisos&rdquo; → &ldquo;Ubicación&rdquo; → permitir
                    para este sitio.
                  </li>
                  <li>
                    En Brave: lo mismo + revisar que la opción de
                    <strong> bloqueo de huellas digitales esté desactivada</strong>
                    {' '}solo para este sitio (Brave bloquea geolocation por defecto).
                  </li>
                  <li>
                    A nivel sistema: Ajustes Android → Ubicación → activada
                    + el navegador con permiso en &ldquo;Permitir todo el
                    tiempo&rdquo; o &ldquo;Solo mientras se usa&rdquo;.
                  </li>
                </ol>
              </details>
            </div>
            <div>
              <p className="font-bold text-amber-300">🎤 Voz no transcribe</p>
              <p className="text-xs text-slate-400 leading-relaxed">Verifique el permiso de micrófono (iOS: Ajustes → Safari → Micrófono → este sitio → Permitir). Necesita conexión activa al servidor de transcripción.</p>
            </div>
            <div>
              <p className="font-bold text-amber-300">📷 La foto no aparece tras adjuntarla</p>
              <p className="text-xs text-slate-400 leading-relaxed">Recargue la pantalla; los datos pueden tardar un momento en aparecer. Si persiste, repórtelo en &ldquo;Reportar problema&rdquo; aquí mismo.</p>
            </div>
            <div>
              <p className="font-bold text-amber-300">🌱 Creé planta y no aparece en la zona</p>
              <p className="text-xs text-slate-400 leading-relaxed">Verifique que la zona esté seleccionada como &ldquo;contenedora&rdquo; en el formulario. En vista &ldquo;Activos → Plantas → Todas&rdquo; aparecen sin filtro.</p>
            </div>
            <div>
              <p className="font-bold text-amber-300">⚠️ Sin red en campo</p>
              <p className="text-xs text-slate-400 leading-relaxed">Todo funciona offline. Sus datos se sincronizan automáticamente cuando vuelva a estar online. Indicador en la barra superior.</p>
            </div>
          </div>
        </Section>

        <p className="text-[11px] text-slate-600 text-center mt-4 italic leading-relaxed">
          Manual v2.2 · Actualizado 2026-07-04 · Colombia es el país de la belleza.
        </p>
      </main>
    </div>
  );
}
