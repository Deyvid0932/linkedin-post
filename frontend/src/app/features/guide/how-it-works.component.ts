import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-6xl mx-auto space-y-8 animate-fadeIn">

      <!-- 1. HEADER DE LA GUÍA -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span class="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-base font-bold shadow-md shadow-blue-500/20">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            </span>
            <span>¿Cómo Funciona el Sistema?</span>
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Guía visual del pipeline autónomo de contenido técnico, evaluación y publicación en LinkedIn
          </p>
        </div>

        <div class="flex items-center gap-3">
          <a routerLink="/studio"
             class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer">
            <span>Ir al Estudio de Contenido</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </a>
        </div>
      </div>

      <!-- 2. DIAGRAMA VISUAL DEL PIPELINE EN 4 PASOS -->
      <div class="space-y-4">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Flujo del Pipeline en 4 Pasos</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          <!-- PASO 1: ORIGEN EN CASCADA -->
          <div class="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 relative overflow-hidden">
            <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold text-xs flex items-center justify-center">
              01
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Detección de Origen</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              El motor evalúa primero si hay nuevos commits en tus <strong>repositorios de GitHub (Prioridad 1)</strong>. Si no hay cambios recientes, pasa automáticamente al <strong>Banco de Ideas (Prioridad 2)</strong>.
            </p>
            <div class="pt-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <span>Cascada Inteligente</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>
          </div>

          <!-- PASO 2: REDACCIÓN TÉCNICA IA -->
          <div class="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 relative overflow-hidden">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs flex items-center justify-center">
              02
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Redacción Técnica</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              La IA genera <strong>3 versiones con enfoques distintos</strong> (Consultoría B2B, Storytelling o Debate Comunitario), optimizadas para el límite de 3,000 caracteres de LinkedIn y estructuradas en 5 bloques.
            </p>
            <div class="pt-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <span>5 Bloques de Impacto</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>
          </div>

          <!-- PASO 3: ESTUDIO & MULTI-IMAGEN -->
          <div class="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 relative overflow-hidden">
            <div class="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-extrabold text-xs flex items-center justify-center">
              03
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Imágenes & Calibración</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              En el Estudio puedes probar el gancho de 3 líneas con el simulador, subir una o <strong>múltiples imágenes personalizadas</strong> y elegir si publicar como Perfil Personal o Página de Empresa.
            </p>
            <div class="pt-2 text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <span>Soporte Multi-Imagen</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>
          </div>

          <!-- PASO 4: PUBLICACIÓN & SEGURIDAD -->
          <div class="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 relative overflow-hidden">
            <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center">
              04
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Publicación en LinkedIn</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Los posts aprobados se suben mediante la API oficial en los horarios configurados con Quartz. Si necesitas pausar todo de golpe, dispones del botón de <strong>Parada de Emergencia</strong>.
            </p>
            <div class="pt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span>Control Total & Auditoría</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>
          </div>

        </div>
      </div>

      <!-- 3. DETALLE DE LA CASCADA DE PRIORIDADES -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Prioridad 1: Proyectos de GitHub</h3>
              <p class="text-xs text-slate-400">Contenido extraído directamente de código real</p>
            </div>
          </div>

          <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            El sistema monitorea las ramas principales de tus repositorios configurados. Cuando detecta un nuevo commit relevante, extrae el mensaje y el diff para construir un post técnico fundamentado en los retos de ingeniería reales que resolviste.
          </p>

          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <svg class="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Evita publicar mensajes vacíos: sintetiza aprendizajes y arquitectura del commit.</span>
          </div>
        </div>

        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Prioridad 2: Banco de Ideas & Temas</h3>
              <p class="text-xs text-slate-400">Respaldo editorial continuo</p>
            </div>
          </div>

          <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Si no hay commits recientes, el pipeline no se detiene: toma automáticamente la siguiente idea de tu banco unificado o profundiza en una línea de investigación de tendencias tecnológicas con la IA.
          </p>

          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <svg class="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Puedes importar ideas en bloque o agregar temas fijos desde la pestaña de Ideas.</span>
          </div>
        </div>

      </div>

      <!-- 4. ESTRUCTURA DE 5 BLOQUES DE ALTO IMPACTO -->
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Anatomía de los Posts Técnicos</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cada publicación sigue una fórmula probada para maximizar la retención antes del corte de 3 líneas
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 space-y-2">
            <span class="font-extrabold text-blue-600 dark:text-blue-400 text-sm">1. Gancho</span>
            <p class="text-slate-600 dark:text-slate-400 text-[11px]">
              Primeras 3 líneas directas y provocativas para incentivar el clic en <em>"...ver más"</em>.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 space-y-2">
            <span class="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">2. Contexto</span>
            <p class="text-slate-600 dark:text-slate-400 text-[11px]">
              Planteamiento del problema de arquitectura, rendimiento o síntoma en producción.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 space-y-2">
            <span class="font-extrabold text-purple-600 dark:text-purple-400 text-sm">3. Solución</span>
            <p class="text-slate-600 dark:text-slate-400 text-[11px]">
              Explicación técnica con comparativa clara, código o métricas de optimización.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 space-y-2">
            <span class="font-extrabold text-amber-600 dark:text-amber-400 text-sm">4. Aprendizajes</span>
            <p class="text-slate-600 dark:text-slate-400 text-[11px]">
              4 a 6 viñetas estructuradas con lecciones clave listas para aplicar.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 space-y-2">
            <span class="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">5. Debate</span>
            <p class="text-slate-600 dark:text-slate-400 text-[11px]">
              Pregunta de cierre para fomentar interacción y debate entre profesionales.
            </p>
          </div>
        </div>
      </div>

      <!-- 5. PREGUNTAS FRECUENTES (FAQ) -->
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Preguntas Frecuentes (FAQ)</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
            <h4 class="font-bold text-slate-900 dark:text-white">¿Cómo puedo añadir múltiples imágenes a una publicación?</h4>
            <p class="text-slate-500 dark:text-slate-400 leading-relaxed">
              En el Estudio de Contenido puedes subir una o varias imágenes desde tu computadora o ingresar URLs directas. El sistema te permite previsualizar la galería o carrusel antes de aprobar.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
            <h4 class="font-bold text-slate-900 dark:text-white">¿Qué publicaciones se envían realmente a LinkedIn?</h4>
            <p class="text-slate-500 dark:text-slate-400 leading-relaxed">
              Únicamente los posts marcados con "Aprobar Post (+1)" o disparados en tus horarios programados de Quartz. Los descartados con "No Me Gusta" nunca se suben.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
            <h4 class="font-bold text-slate-900 dark:text-white">¿Puedo publicar tanto en mi Perfil Personal como en mi Página de Empresa?</h4>
            <p class="text-slate-500 dark:text-slate-400 leading-relaxed">
              Sí. Desde la sección de Conexiones puedes vincular ambas cuentas y activar o pausar cada una con su propio interruptor independiente. En el Estudio podrás elegir el destino antes de publicar.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
            <h4 class="font-bold text-slate-900 dark:text-white">¿Qué hace la Parada de Emergencia?</h4>
            <p class="text-slate-500 dark:text-slate-400 leading-relaxed">
              El botón de Parada de Emergencia en la barra superior suspende al instante cualquier publicación programada en el servidor y bloquea llamadas a la API de LinkedIn.
            </p>
          </div>
        </div>
      </div>

    </div>
  `
})
export class HowItWorksComponent {}
