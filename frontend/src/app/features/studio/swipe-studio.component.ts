import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CredentialService } from '../../core/services/credential.service';
import { TenantService } from '../../core/services/tenant.service';
import { StudioService } from '../../core/services/studio.service';
import { LinkedInAccount } from '../../core/models/credential.model';
import { UserProfile } from '../../core/models/auth.model';
import { SwipeVersion, SwipeBatch, ImageAspectRatio } from '../../core/models/studio.model';

@Component({
  selector: 'app-swipe-studio',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './swipe-studio.component.html',
})
export class SwipeStudioComponent implements OnInit {
  private readonly safeDefaultPrompt =
    'Redacta publicaciones profesionales para LinkedIn en español. Usa únicamente los datos, experiencias y opiniones que aporte el usuario; no inventes logros, cargos ni información personal. Explica las ideas con claridad y termina con una pregunta o invitación pertinente cuando encaje.';
  private readonly legacyIdentityPromptPrefix =
    'Eres Deyvid Jair Chupillon Silva, Desarrollador Junior Frontend/Fullstack apasionado por Spring Boot, Angular y la arquitectura de software moderna.';
  private studioService = inject(StudioService);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private credentialService = inject(CredentialService);
  private tenantService = inject(TenantService);

  hasUnsavedContent(): boolean {
    return (
      this.isPromptDirty() ||
      this.isEditing() ||
      !!this.currentVersion()?.textoGenerado ||
      this.currentImages().length > 0
    );
  }
  accounts = signal<LinkedInAccount[]>([]);
  enabledAccounts = computed(() => this.accounts().filter((a) => a.isEnabled));
  selectedTargetId = signal<string | null>(null);
  variantLoading = signal(false);

  // Selector de Formato de Post: arranca en DETAILED (Análisis)
  postFormat = signal<'MICRO' | 'DETAILED'>('DETAILED');

  // Estados dedicados de error
  aiConfigError = signal(false);
  genericError = signal<string | null>(null);

  // Loading local por pestaña para no bloquear todo el componente
  tabGeneratingIndex = signal<number | null>(null);

  // Selector de Modo de Generación: 'IDEAS' (Banco de Ideas), 'PROMPT' (Personalidad & System Prompt), 'GITHUB' (Repositorio)
  sourceMode = signal<'PROMPT' | 'GITHUB' | 'IDEAS'>('IDEAS');
  modeDropdownOpen = signal(false);
  systemPrompt = signal<string>(this.safeDefaultPrompt);
  savingSystemPrompt = signal(false);
  isPromptDirty = signal(false);

  loading = signal(false);
  imageLoading = signal(true);
  submitting = signal(false);
  activeAction = signal<number | null>(null);
  buttonFeedbackNotice = signal<string | null>(null);
  isEditing = signal(false);
  isEditingHeadline = signal(false);
  isFeedTruncated = signal(true);
  isExpanded = signal(false);
  batch = signal<SwipeBatch | null>(null);
  currentIndex = signal(0);
  alertMessage = signal<string | null>(null);
  queuedCount = signal<number>(0);

  // Formato de aspect ratio de imagen
  aspectRatio = signal<ImageAspectRatio>('16:9');

  // Headline editable del usuario
  userHeadline = signal<string>('');

  // Estado para drag & drop y carga de archivos locales
  isDragging = signal(false);
  customImageFileName = signal<string | null>(null);

  // Mapa de semillas por versión para que cada cambio de ángulo tenga una imagen distinta
  private versionSeeds = signal<{ [versionId: string]: number }>({});

  userName = computed(
    () => (this.authService.currentUserSignal() as UserProfile | null)?.name || 'Tu nombre',
  );

  userInitials = computed(() => {
    const name = this.userName();
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  });

  currentVersion = computed<SwipeVersion | null>(() => {
    const b = this.batch();
    if (!b || !b.versions || !b.versions.length) return null;
    const idx = this.currentIndex();
    return b.versions[idx] || b.versions[0];
  });

  // Métricas dinámicas en tiempo real del texto
  textMetrics = computed(() => {
    const text = this.currentVersion()?.textoGenerado || '';
    const charCount = text.length;
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const readingTimeSec = Math.max(5, Math.round((words / 200) * 60));
    const hashtagCount = (text.match(/#[a-zA-Z0-9_]+/g) || []).length;
    const emojiCount = (
      text.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []
    ).length;

    let clarity = 95;
    if (charCount < 600) clarity -= 10;
    if (charCount > 2200) clarity -= 15;
    if (hashtagCount > 7) clarity -= 10;

    return {
      charCount,
      words,
      readingTimeSec,
      hashtagCount,
      emojiCount,
      clarityScore: Math.max(50, Math.min(99, clarity)),
    };
  });

  charCountPercentage = computed(() => {
    const count = this.textMetrics().charCount;
    const base = this.postFormat() === 'MICRO' ? 650 : 1500;
    return Math.min(100, Math.round((count / base) * 100));
  });

  charCountStatus = computed(() => {
    const count = this.textMetrics().charCount;
    if (this.postFormat() === 'MICRO') {
      if (count < 350) {
        return { label: 'Breve (<350 chars)', color: 'text-amber-500', barColor: 'bg-amber-500' };
      }
      if (count <= 650) {
        return {
          label: 'Óptimo Micro-Post (400 - 650 chars sin ...ver más)',
          color: 'text-emerald-500',
          barColor: 'bg-emerald-500',
        };
      }
      if (count <= 900) {
        return {
          label: 'Extenso para Micro-Post (>650 chars)',
          color: 'text-blue-500',
          barColor: 'bg-blue-500',
        };
      }
      return {
        label: 'Excede formato Snackable (>900 chars)',
        color: 'text-rose-500',
        barColor: 'bg-rose-500',
      };
    }

    // Modo DETAILED (Análisis Técnico 1,000 - 1,500 chars)
    if (count < 900) {
      return { label: 'Breve (<900 chars)', color: 'text-amber-500', barColor: 'bg-amber-500' };
    }
    if (count <= 1800) {
      return {
        label: 'Óptimo Técnico (1,000 - 1,800 chars para LinkedIn)',
        color: 'text-emerald-500',
        barColor: 'bg-emerald-500',
      };
    }
    if (count <= 2500) {
      return {
        label: 'Extenso (1,800 - 2,500 chars)',
        color: 'text-blue-500',
        barColor: 'bg-blue-500',
      };
    }
    return {
      label: 'Cerca del límite (>2,500 chars)',
      color: 'text-rose-500',
      barColor: 'bg-rose-500',
    };
  });

  // Lista de imágenes de la versión activa (soporta múltiples hasta 4)
  currentImages = computed<string[]>(() => {
    const v = this.currentVersion();
    if (!v) return [];
    if (v.imageUrls && v.imageUrls.length > 0) return v.imageUrls;
    if (v.imageUrl && v.imageUrl.trim().length > 0) return [v.imageUrl];
    return [];
  });

  // Indicador de si la versión actual cuenta con imagen cargada
  hasImage = computed<boolean>(() => {
    const v = this.currentVersion();
    return !!(v && (v.imageUrl || (v.imageUrls && v.imageUrls.length > 0)));
  });

  // URL dinámica: devuelve la imagen personalizada o cargada por el usuario (o null si no hay imagen)
  activeImageUrl = computed<string | null>(() => {
    const imgs = this.currentImages();
    return imgs.length > 0 ? imgs[0] : null;
  });

  private readonly STORAGE_KEY = 'swipe_studio_active_state_v2';

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeModeDropdown();
  }

  toggleModeDropdown(): void {
    this.modeDropdownOpen.set(!this.modeDropdownOpen());
  }

  closeModeDropdown(): void {
    this.modeDropdownOpen.set(false);
  }

  selectMode(mode: 'PROMPT' | 'GITHUB' | 'IDEAS'): void {
    this.closeModeDropdown();
    if (this.sourceMode() === mode || this.loading()) return;
    this.setSourceMode(mode);
    this.generateNewBatch();
  }

  getModeLabel(mode: 'PROMPT' | 'GITHUB' | 'IDEAS'): string {
    switch (mode) {
      case 'PROMPT':
        return 'Prompt IA';
      case 'GITHUB':
        return 'Repo GitHub';
      case 'IDEAS':
        return 'Banco de Ideas';
    }
  }

  setPostFormat(format: 'MICRO' | 'DETAILED'): void {
    if (this.postFormat() === format || this.loading()) return;
    this.postFormat.set(format);
    this.saveStudioState();
    this.generateNewBatch();
  }

  saveStudioState(): void {
    try {
      const state = {
        batch: this.batch(),
        currentIndex: this.currentIndex(),
        postFormat: this.postFormat(),
        sourceMode: this.sourceMode(),
        systemPrompt: this.systemPrompt(),
        userHeadline: this.userHeadline(),
        timestamp: Date.now(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('No se pudo guardar el estado local del estudio:', e);
    }
  }

  loadStudioState(): boolean {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return false;
      const state = JSON.parse(raw);
      if (state && state.batch && state.batch.versions && state.batch.versions.length > 0) {
        this.batch.set(state.batch);
        this.currentIndex.set(typeof state.currentIndex === 'number' ? state.currentIndex : 0);
        if (state.postFormat) this.postFormat.set(state.postFormat);
        if (state.sourceMode) this.sourceMode.set(state.sourceMode);
        if (state.systemPrompt) {
          this.systemPrompt.set(this.normalizeLegacyPrompt(state.systemPrompt));
        }
        if (state.userHeadline && !state.userHeadline.startsWith('Senior Software Engineer |')) {
          this.userHeadline.set(state.userHeadline);
        }
        return true;
      }
    } catch (e) {
      console.warn('Error al restaurar estado guardado del estudio:', e);
    }
    return false;
  }

  ngOnInit(): void {
    this.loadLinkedInAccounts();
    this.loadQueueCount();
    this.loadTenantSystemPrompt();

    this.route.queryParams.subscribe((params) => {
      if (params['repo']) {
        this.sourceMode.set('GITHUB');
        this.generateBatchForRepo(params['repo']);
      } else if (params['topic']) {
        this.sourceMode.set('IDEAS');
        this.generateBatchForCustomTopic(params['topic']);
      } else {
        const restored = this.loadStudioState();
        if (!restored) {
          this.generateNewBatch();
        }
      }
    });
  }

  loadTenantSystemPrompt(): void {
    this.tenantService.getProfile().subscribe({
      next: (profile) => {
        if (profile?.systemPrompt) {
          const prompt = this.normalizeLegacyPrompt(profile.systemPrompt);
          this.systemPrompt.set(prompt);
          if (prompt !== profile.systemPrompt) this.isPromptDirty.set(true);
        }
      },
      error: () => {},
    });
  }

  private normalizeLegacyPrompt(prompt: string): string {
    if (!prompt.startsWith(this.legacyIdentityPromptPrefix)) return prompt;
    const remainingInstructions = prompt.slice(this.legacyIdentityPromptPrefix.length).trim();
    return [this.safeDefaultPrompt, remainingInstructions].filter(Boolean).join(' ');
  }

  onSystemPromptChange(newVal: string): void {
    this.systemPrompt.set(newVal);
    this.isPromptDirty.set(true);
    this.saveStudioState();
  }

  saveSystemPromptFromStudio(): void {
    this.savingSystemPrompt.set(true);
    this.tenantService
      .updateProfile({
        systemPrompt: this.systemPrompt(),
      })
      .subscribe({
        next: () => {
          this.savingSystemPrompt.set(false);
          this.isPromptDirty.set(false);
          this.alertMessage.set('✨ Personalidad y System Prompt de la IA guardados exitosamente.');
          this.saveStudioState();
        },
        error: () => {
          this.savingSystemPrompt.set(false);
          this.alertMessage.set('No se pudo guardar el System Prompt.');
        },
      });
  }

  setSourceMode(mode: 'PROMPT' | 'GITHUB' | 'IDEAS'): void {
    this.sourceMode.set(mode);
    this.saveStudioState();
  }

  loadQueueCount(): void {
    this.studioService.getQueueCount().subscribe({
      next: (res) => this.queuedCount.set(res?.queueCount || 0),
      error: () => {},
    });
  }

  loadLinkedInAccounts(): void {
    this.credentialService.getLinkedInAccounts().subscribe({
      next: (accs) => {
        this.accounts.set(accs || []);
        const enabled = (accs || []).filter((a) => a.isEnabled);
        const primary = enabled.find((a) => a.isPrimary) || enabled[0];
        if (primary) {
          this.selectedTargetId.set(primary.id);
        }
      },
      error: () => {},
    });
  }

  generateBatchForRepo(repoName: string): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.aiConfigError.set(false);
    this.genericError.set(null);
    this.alertMessage.set(null);
    this.isEditing.set(false);
    this.isExpanded.set(false);
    this.imageLoading.set(true);

    this.studioService
      .fetchSwipeBatch('GITHUB', undefined, repoName, true, this.postFormat())
      .subscribe({
        next: (data) => {
          this.batch.set(data);
          this.currentIndex.set(0);
          this.loading.set(false);
          this.saveStudioState();
        },
        error: (err) => {
          this.loading.set(false);
          this.handleGenerationError(err);
        },
      });
  }

  generateBatchForCustomTopic(topicTitle: string): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.aiConfigError.set(false);
    this.genericError.set(null);
    this.alertMessage.set(null);
    this.isEditing.set(false);
    this.isExpanded.set(false);
    this.imageLoading.set(true);

    this.studioService
      .fetchSwipeBatch('RESEARCH', topicTitle, undefined, true, this.postFormat())
      .subscribe({
        next: (data) => {
          this.batch.set(data);
          this.currentIndex.set(0);
          this.loading.set(false);
          this.saveStudioState();
        },
        error: (err) => {
          this.loading.set(false);
          this.handleGenerationError(err);
        },
      });
  }

  generateNewBatch(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.aiConfigError.set(false);
    this.genericError.set(null);
    this.alertMessage.set(null);
    this.isEditing.set(false);
    this.isExpanded.set(false);
    this.imageLoading.set(true);

    const mode = this.sourceMode();
    const promptVal = mode === 'PROMPT' ? this.systemPrompt() : undefined;
    const format = this.postFormat();

    this.studioService.fetchSwipeBatch(mode, promptVal, undefined, true, format).subscribe({
      next: (batch) => {
        this.batch.set(batch);
        this.currentIndex.set(0);
        this.loading.set(false);
        this.saveStudioState();
      },
      error: (err) => {
        this.loading.set(false);
        this.handleGenerationError(err);
      },
    });
  }

  selectVersionIndex(index: number): void {
    this.currentIndex.set(index);
    this.imageLoading.set(true);
    this.isExpanded.set(false);

    const currentBatch = this.batch();
    const v = currentBatch?.versions?.[index];

    // Si la variante ya tiene texto (ya fue generada), no hacemos llamada HTTP
    if (!v || v.textoGenerado?.trim()) {
      this.saveStudioState();
      return;
    }

    // Si no tiene texto, se genera bajo demanda
    this.tabGeneratingIndex.set(index);
    const approach = v.estructuraUsada || 'COMPARATIVE_B2B';
    const mode = this.sourceMode();
    const promptVal =
      mode === 'PROMPT'
        ? this.systemPrompt()
        : mode === 'IDEAS'
          ? this.batch()?.topicTitle
          : undefined;
    const repoName = mode === 'GITHUB' ? this.batch()?.topicTitle || undefined : undefined;
    const format = this.postFormat();

    this.studioService.fetchSingleVersion(approach, mode, promptVal, repoName, format).subscribe({
      next: (versionData) => {
        this.updateVersionInBatch(index, versionData);
        this.tabGeneratingIndex.set(null);
        this.saveStudioState();
      },
      error: (err) => {
        this.tabGeneratingIndex.set(null);
        this.handleGenerationError(err);
      },
    });
  }

  generateCurrentVariant(): void {
    const cur = this.currentVersion();
    if (!cur) return;
    const idx = this.currentIndex();
    const approach = cur.estructuraUsada || 'COMPARATIVE_B2B';
    this.variantLoading.set(true);
    this.genericError.set(null);

    const mode = this.sourceMode();
    const promptVal =
      mode === 'PROMPT'
        ? this.systemPrompt()
        : mode === 'IDEAS'
          ? this.batch()?.topicTitle
          : undefined;
    const repoName = mode === 'GITHUB' ? this.batch()?.topicTitle || undefined : undefined;
    const format = this.postFormat();

    this.studioService.fetchSingleVersion(approach, mode, promptVal, repoName, format).subscribe({
      next: (versionData) => {
        this.updateVersionInBatch(idx, versionData);
        this.variantLoading.set(false);
        this.saveStudioState();
      },
      error: (err) => {
        this.variantLoading.set(false);
        this.handleGenerationError(err);
      },
    });
  }

  private updateVersionInBatch(index: number, versionData: SwipeVersion): void {
    const curBatch = this.batch();
    if (!curBatch || !curBatch.versions) return;
    const updatedVersions = [...curBatch.versions];
    if (index >= 0 && index < updatedVersions.length) {
      updatedVersions[index] = {
        ...updatedVersions[index],
        textoGenerado: versionData.textoGenerado,
        imageUrl: versionData.imageUrl || updatedVersions[index].imageUrl,
        tokensUsed: versionData.tokensUsed,
        costUsd: versionData.costUsd,
        percentMonthlyCredit: versionData.percentMonthlyCredit,
      };
      this.batch.set({
        ...curBatch,
        versions: updatedVersions,
      });
    }
  }

  private handleGenerationError(err: any): void {
    if (err?.status === 424 || err?.error?.errorCode === 'AI_NOT_CONFIGURED') {
      this.aiConfigError.set(true);
    } else {
      const msg = err?.error?.message || 'Error al conectar con la IA. Inténtalo de nuevo.';
      this.genericError.set(msg);
      this.alertMessage.set('❌ ' + msg);
    }
  }

  toggleFeedTruncation(): void {
    this.isFeedTruncated.set(!this.isFeedTruncated());
    this.isExpanded.set(false);
  }

  setAspectRatio(ratio: ImageAspectRatio): void {
    this.aspectRatio.set(ratio);
    this.imageLoading.set(true);
  }

  getAspectRatioClass(): string {
    switch (this.aspectRatio()) {
      case '1:1':
        return 'aspect-square max-w-[440px] mx-auto';
      case '4:5':
        return 'aspect-[4/5] max-w-[400px] mx-auto';
      case '16:9':
      default:
        return 'aspect-video max-h-[380px] sm:max-h-[440px]';
    }
  }

  getResolutionLabel(): string {
    switch (this.aspectRatio()) {
      case '1:1':
        return '1080 × 1080 (Cuadrado)';
      case '4:5':
        return '1080 × 1350 (Retrato)';
      case '16:9':
      default:
        return '1200 × 630 (Banner)';
    }
  }

  regenerateCurrentVersionImage(): void {
    const v = this.currentVersion();
    const b = this.batch();
    if (!v) return;

    this.imageLoading.set(true);
    const query = b?.topicTitle || 'data analytics dashboard';

    this.studioService.searchImage(query).subscribe({
      next: (res) => {
        if (res && res.imageUrl) {
          this.updateCurrentVersionImages([res.imageUrl]);
        }
        this.imageLoading.set(false);
      },
      error: () => {
        this.imageLoading.set(false);
      },
    });
  }

  onImageLoaded(): void {
    this.imageLoading.set(false);
  }

  onImageError(): void {
    this.imageLoading.set(false);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleMultipleFiles(files);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleMultipleFiles(input.files);
    }
  }

  onMultipleFilesSelected(event: Event): void {
    this.onFileInputChange(event);
  }

  handleMultipleFiles(files: FileList | File[]): void {
    const fileList = Array.from(files).slice(0, 4);
    const currentImgs = [...this.currentImages()];

    for (const file of fileList) {
      if (!file.type.startsWith('image/')) continue;
      if (currentImgs.length >= 4) break;

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result && currentImgs.length < 4) {
          currentImgs.push(result);
          this.updateCurrentVersionImages([...currentImgs]);
        }
      };
      reader.readAsDataURL(file);
    }
    this.alertMessage.set('Fotos añadidas correctamente.');
  }

  removeImage(index: number): void {
    const updated = [...this.currentImages()];
    updated.splice(index, 1);
    this.updateCurrentVersionImages(updated);
  }

  clearAllImages(): void {
    this.updateCurrentVersionImages([]);
  }

  updateCurrentText(newText: string): void {
    const b = this.batch();
    if (!b || !b.versions.length) return;
    const versions = [...b.versions];
    versions[this.currentIndex()] = {
      ...versions[this.currentIndex()],
      textoGenerado: newText,
    };
    this.batch.set({ ...b, versions });
    this.saveStudioState();
  }

  updateCurrentVersionImages(images: string[]): void {
    const b = this.batch();
    if (!b || !b.versions.length) return;
    const versions = [...b.versions];
    versions[this.currentIndex()] = {
      ...versions[this.currentIndex()],
      imageUrl: images[0] || '',
      imageUrls: images,
    };
    this.batch.set({ ...b, versions });
    this.saveStudioState();
  }

  sendFeedback(score: number): void {
    if (this.submitting()) return;

    const v = this.currentVersion();
    const b = this.batch();
    if (!v || !b) return;

    if (score === 1 && (!v.textoGenerado || v.textoGenerado.trim().length < 50)) {
      this.alertMessage.set(
        '⚠️ Primero debes generar el contenido de esta variante con el botón de DeepSeek antes de aprobar.',
      );
      return;
    }

    this.submitting.set(true);
    this.activeAction.set(score);
    this.alertMessage.set(null);
    this.buttonFeedbackNotice.set(null);

    const imgs = this.currentImages();
    const selectedAcc = this.accounts().find((a) => a.id === this.selectedTargetId());

    const body = {
      textoGenerado: v.textoGenerado,
      tema: b.topicTitle,
      puntajeUsuario: score,
      estructuraUsada: v.estructuraUsada,
      sourceMode: b.sourceMode,
      imageUrl: imgs[0] || null,
      imageUrls: imgs,
      tokensUsed: v.tokensUsed,
      costUsd: v.costUsd,
      targetCredentialId: this.selectedTargetId(),
      targetAccountType: selectedAcc?.accountType,
    };

    this.studioService.sendFeedback(body as any).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.activeAction.set(null);
        this.handleFeedbackSuccess(score, res);
      },
      error: () => {
        this.submitting.set(false);
        this.activeAction.set(null);
        this.alertMessage.set('No se pudo procesar la solicitud en este momento.');
      },
    });
  }

  private handleFeedbackSuccess(score: number, res?: any): void {
    let notice = '';
    if (score === 1) {
      const count = res?.queuedCount ?? this.queuedCount() + 1;
      this.queuedCount.set(count);
      this.alertMessage.set(res?.message || `¡Post aprobado y programado! (${count} en cola)`);
      notice = `¡Post aprobado y encolado (#${count})! Generando siguiente tema...`;
    } else {
      this.alertMessage.set('Lote completo descartado.');
      notice = 'Lote descartado. Generando siguiente tema...';
    }

    this.buttonFeedbackNotice.set(notice);

    setTimeout(() => {
      this.buttonFeedbackNotice.set(null);
      this.generateNewBatch();
    }, 1000);
  }
}
