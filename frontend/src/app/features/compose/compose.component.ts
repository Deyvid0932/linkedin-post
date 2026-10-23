import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import {
  ContentDraft,
  ContentDraftService,
  ComposePayload,
  AdaptationChannel,
  AdaptedContent,
} from '../../core/services/content-draft.service';
import { CredentialService } from '../../core/services/credential.service';
import { LinkedInAccount } from '../../core/models/credential.model';
import { AuthService } from '../../core/services/auth.service';
import { SwipeStudioComponent } from '../studio/swipe-studio.component';

@Component({
  selector: 'app-compose',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SwipeStudioComponent],
  templateUrl: './compose.component.html',
  styleUrl: './compose.component.css',
})
export class ComposeComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ContentDraftService);
  private credentials = inject(CredentialService);
  private route = inject(ActivatedRoute);
  user = inject(AuthService).currentUserSignal;
  advanced = signal(false);
  readonly advancedOpened = signal(false);
  readonly reviewed = signal(false);
  private readonly studio = viewChild(SwipeStudioComponent);
  private readonly destroy = inject(DestroyRef);
  drafts = signal<ContentDraft[]>([]);
  accounts = signal<LinkedInAccount[]>([]);
  loading = signal(true);
  busy = signal(false);
  readingImage = signal(false);
  image = signal<string | null>(null);
  imageName = signal('');
  currentId = signal<string | undefined>(undefined);
  queued = signal(false);
  error = signal('');
  message = signal('');
  prompt = signal('');
  action = signal('');
  text = signal('');
  adaptationLoading = signal(false);
  adaptationError = signal('');
  adaptationMessage = signal('');
  adaptedContent = signal<AdaptedContent | null>(null);
  adaptedText = signal('');
  adaptedDirty = computed(() => {
    const variant = this.adaptedContent();
    return !!variant && this.adaptedText() !== variant.text;
  });
  savedVariants = signal<AdaptedContent[]>([]);
  variantsLoading = signal(false);
  variantSaving = signal(false);
  readonly adaptationChannels: { id: AdaptationChannel; label: string; format: string }[] = [
    { id: 'X', label: 'X', format: 'Publicación breve' },
    { id: 'YOUTUBE_SHORTS', label: 'YouTube Shorts', format: 'Guion vertical' },
    { id: 'TIKTOK', label: 'TikTok', format: 'Gancho y caption' },
  ];
  initials = computed(() =>
    (this.user()?.name || 'Tu nombre')
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase(),
  );
  private requestedDraftId: string | null = null;
  tones = [
    {
      value: 'PROFESSIONAL',
      label: 'Profesional y cercano',
      detail: 'Claro, confiable y sin formalidad excesiva',
    },
    {
      value: 'TECHNICAL',
      label: 'Técnico y directo',
      detail: 'Decisiones, detalles y aprendizajes prácticos',
    },
    {
      value: 'PERSONAL',
      label: 'Personal y reflexivo',
      detail: 'Tu perspectiva, con experiencias que tú aportes',
    },
    {
      value: 'CONVERSATIONAL',
      label: 'Conversacional',
      detail: 'Natural, sencillo y abierto al diálogo',
    },
  ];
  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    text: ['', Validators.maxLength(3000)],
    tone: ['', Validators.required],
    audience: ['', [Validators.required, Validators.maxLength(200)]],
    goal: ['', Validators.required],
    instructions: ['', Validators.maxLength(1500)],
    targetCredentialId: [''],
  });

  ngOnInit() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      this.advanced.set(params.get('advanced') === 'true');
      if (this.advanced()) this.advancedOpened.set(true);
      this.requestedDraftId = params.get('draft');
      const draft = this.drafts().find((item) => item.id === this.requestedDraftId);
      if (draft) this.open(draft);
    });
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        this.reviewed.set(false);
        this.adaptedContent.set(null);
        this.adaptedText.set('');
      });
    this.load();
  }
  review(): void {
    if (this.form.invalid || !this.form.controls.text.value.trim()) {
      this.form.markAllAsTouched();
      this.error.set('Completa el texto y sus preferencias antes de revisar.');
      return;
    }
    this.reviewed.set(true);
    this.message.set('Texto revisado. Comprueba la cuenta y aprueba cuando estés listo.');
  }
  canLeave() {
    return (
      !(this.form.dirty || this.studio()?.hasUnsavedContent() || this.adaptedDirty()) ||
      window.confirm('Tienes cambios sin guardar. ¿Quieres salir del editor?')
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent) {
    if (this.form.dirty || this.studio()?.hasUnsavedContent() || this.adaptedDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  load() {
    this.loading.set(true);
    this.service
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (d) => {
          this.drafts.set(d);
          const requested = d.find((item) => item.id === this.requestedDraftId);
          if (requested) this.open(requested);
        },
        error: () =>
          this.error.set('No pudimos cargar tus borradores. Puedes volver a intentarlo.'),
      });
    this.credentials.getLinkedInAccounts().subscribe({
      next: (a) => this.accounts.set(a.filter((x) => x.isEnabled && x.status === 'ACTIVE')),
      error: () =>
        this.error.set(
          'No pudimos cargar tus cuentas de LinkedIn. Revisa Conexiones antes de aprobar un post.',
        ),
    });
  }
  payload(withImage = true): ComposePayload {
    const value = this.form.getRawValue();
    return {
      ...value,
      imageUrl: withImage ? this.image() : null,
      targetCredentialId: value.targetCredentialId || null,
    };
  }
  private ready() {
    this.error.set('');
    this.message.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa el título, el tono, el público y el objetivo.');
      return false;
    }
    return !this.busy() && !this.readingImage() && !this.queued();
  }
  generate(fromImage: boolean) {
    if (!this.ready()) return;
    if (fromImage && !this.image()) {
      this.error.set('Sube una imagen primero.');
      return;
    }
    if (!fromImage && !this.form.controls.text.value.trim()) {
      this.error.set('Escribe una idea o un texto para mejorarlo.');
      return;
    }
    this.busy.set(true);
    this.action.set(
      fromImage ? 'Analizando la imagen y preparando tu propuesta…' : 'Mejorando tu texto…',
    );
    this.service
      .generate(this.payload(fromImage))
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (result) => {
          this.form.controls.text.setValue(result.text);
          this.form.markAsDirty();
          this.text.set(result.text);
          this.prompt.set(result.prompt);
          this.message.set(
            'Propuesta lista. Revisa los hechos y edita lo que quieras antes de aprobar.',
          );
        },
        error: (e) =>
          this.showError(e, 'No pudimos generar la propuesta. Tu contenido sigue aquí.'),
      });
  }
  adaptForChannel(channel: AdaptationChannel) {
    this.adaptationError.set('');
    this.adaptationMessage.set('');
    if (this.form.invalid || !this.form.controls.text.value.trim()) {
      this.form.markAllAsTouched();
      this.adaptationError.set('Completa las preferencias y el texto antes de generar una variante.');
      return;
    }
    if (this.queued() || this.busy() || this.readingImage() || this.adaptationLoading()) return;
    this.adaptationLoading.set(true);
    this.service
      .adapt(this.payload(false), channel)
      .pipe(finalize(() => this.adaptationLoading.set(false)))
      .subscribe({
        next: (variant) => {
          this.adaptedContent.set(variant);
          this.adaptedText.set(variant.text);
          this.adaptationMessage.set(`Versión para ${this.channelLabel(channel)} lista. No se ha guardado ni publicado.`);
        },
        error: (e) =>
          this.adaptationError.set(
            e?.error?.message || 'No pudimos generar la variante. Tu borrador original sigue intacto.',
          ),
      });
  }
  channelLabel(channel: AdaptationChannel): string {
    return this.adaptationChannels.find((item) => item.id === channel)?.label || channel;
  }
  loadVariants(draftId: string) {
    this.variantsLoading.set(true);
    this.service
      .listVariants(draftId)
      .pipe(finalize(() => this.variantsLoading.set(false)))
      .subscribe({
        next: (variants) => this.savedVariants.set(variants || []),
        error: () => this.adaptationError.set('No se pudieron cargar las variantes guardadas.'),
      });
  }
  viewSavedVariant(variant: AdaptedContent) {
    this.adaptedContent.set(variant);
    this.adaptedText.set(variant.text);
    this.adaptationError.set('');
    this.adaptationMessage.set(`Variante guardada para ${this.channelLabel(variant.channel)}.`);
  }
  editAdaptedText(event: Event) {
    this.adaptedText.set((event.target as HTMLTextAreaElement).value);
    this.adaptationError.set('');
    this.adaptationMessage.set('');
  }
  saveAdaptedVariant() {
    const variant = this.adaptedContent();
    if (!variant || this.variantSaving() || this.queued() || (variant.id && !this.adaptedDirty())) return;
    const variantText = this.adaptedText().trim();
    if (!variantText) {
      this.adaptationError.set('Escribe el texto de la variante antes de guardarla.');
      return;
    }
    if (variantText.length > variant.recommendedCharacters) {
      this.adaptationError.set(`La variante supera el objetivo de ${variant.recommendedCharacters} caracteres.`);
      return;
    }
    this.variantSaving.set(true);
    this.busy.set(true);
    this.action.set('Guardando el borrador y su variante…');
    this.adaptationError.set('');
    this.adaptationMessage.set('');
    let sourceDraftSaved = false;
    let variantSaved = false;
    this.service
      .save(this.payload(), this.currentId())
      .pipe(
        switchMap((savedDraft) => {
          sourceDraftSaved = true;
          this.currentId.set(savedDraft.id);
          this.form.markAsPristine();
          return this.service.saveVariant(savedDraft.id, {
            channel: variant.channel,
            text: variantText,
          });
        }),
        finalize(() => {
          this.variantSaving.set(false);
          this.busy.set(false);
          this.loadDrafts();
          if (!variantSaved && this.currentId()) this.loadVariants(this.currentId()!);
        }),
      )
      .subscribe({
        next: (savedVariant) => {
          variantSaved = true;
          this.savedVariants.update((items) => [
            savedVariant,
            ...items.filter((item) => item.channel !== savedVariant.channel),
          ]);
          this.adaptedContent.set(savedVariant);
          this.adaptedText.set(savedVariant.text);
          this.adaptationMessage.set(`Variante de ${this.channelLabel(savedVariant.channel)} guardada junto al borrador.`);
        },
        error: (e) => {
          this.adaptationError.set(
            e?.error?.message || 'No se pudo guardar la variante. Tu borrador original se conserva.',
          );
          if (sourceDraftSaved) this.adaptationMessage.set('El borrador se guardó, pero la variante sigue disponible para reintentar.');
        },
      });
  }
  async copyAdaptedContent() {
    const variant = this.adaptedContent();
    if (!variant) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(this.adaptedText());
      this.adaptationError.set('');
      this.adaptationMessage.set('Texto copiado. Recuerda que debes publicarlo desde la plataforma correspondiente.');
    } catch {
      this.adaptationError.set('No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.');
    }
  }
  save(approve = false) {
    if (!this.ready()) return;
    if (approve && !this.reviewed()) {
      this.error.set('Revisa el contenido antes de aprobar.');
      return;
    }
    if (
      approve &&
      (!this.form.controls.text.value.trim() || !this.form.controls.targetCredentialId.value)
    ) {
      this.error.set('Para aprobar, añade el texto y elige la cuenta de destino.');
      return;
    }
    this.busy.set(true);
    this.action.set(approve ? 'Guardando y aprobando tu publicación…' : 'Guardando tu borrador…');
    this.service
      .save(this.payload(), this.currentId())
      .pipe(
        switchMap((saved) => {
          this.currentId.set(saved.id);
          this.form.markAsPristine();
          return approve ? this.service.approve(saved.id) : [saved];
        }),
        finalize(() => {
          this.busy.set(false);
          this.loadDrafts();
        }),
      )
      .subscribe({
        next: (saved) => {
          this.queued.set(saved.queued);
          this.message.set(
            approve
              ? 'Post aprobado. Revisa la cola y el mecanismo de publicación antes del envío.'
              : 'Borrador guardado. Puedes retomarlo cuando quieras.',
          );
        },
        error: (e) =>
          this.showError(
            e,
            'No pudimos completar el guardado. Conserva el texto y vuelve a intentarlo.',
          ),
      });
  }
  private loadDrafts() {
    this.service.list().subscribe({
      next: (d) => this.drafts.set(d),
      error: () => this.error.set('No pudimos actualizar la lista de borradores.'),
    });
  }
  open(draft: ContentDraft) {
    if (
      (this.form.dirty || this.adaptedDirty()) &&
      !window.confirm('Tienes cambios sin guardar. ¿Quieres abrir otro borrador?')
    )
      return;
    this.currentId.set(draft.id);
    this.queued.set(draft.queued);
    this.image.set(draft.imageUrl || null);
    this.imageName.set('Imagen guardada');
    this.form.reset({
      title: draft.title || '',
      text: draft.text || '',
      tone: draft.tone || '',
      audience: draft.audience || '',
      goal: draft.goal || '',
      instructions: draft.instructions || '',
      targetCredentialId: draft.targetCredentialId || '',
    });
    this.text.set(draft.text || '');
    this.error.set('');
    this.message.set('');
    this.prompt.set('');
    this.adaptedContent.set(null);
    this.adaptedText.set('');
    this.savedVariants.set([]);
    this.loadVariants(draft.id);
  }
  newDraft() {
    if (
      (this.form.dirty || this.adaptedDirty()) &&
      !window.confirm('Tienes cambios sin guardar. ¿Quieres empezar un nuevo borrador?')
    )
      return;
    this.currentId.set(undefined);
    this.queued.set(false);
    this.image.set(null);
    this.imageName.set('');
    this.form.reset();
    this.text.set('');
    this.error.set('');
    this.message.set('');
    this.prompt.set('');
    this.adaptedContent.set(null);
    this.adaptedText.set('');
    this.savedVariants.set([]);
  }
  unqueue() {
    const id = this.currentId();
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.action.set('Retirando de la cola…');
    this.service
      .unqueue(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.queued.set(false);
          this.message.set('Retirado de la cola. Ya puedes editarlo.');
          this.loadDrafts();
        },
        error: (e) => this.showError(e, 'No se pudo retirar de la cola.'),
      });
  }
  async selectImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy() || this.queued()) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.error.set('Elige una imagen PNG o JPEG de hasta 5 MB.');
      return;
    }
    this.readingImage.set(true);
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      this.image.set(result);
      this.imageName.set(file.name);
      this.form.markAsDirty();
      this.reviewed.set(false);
      this.error.set('');
    } catch {
      this.error.set('No pudimos leer la imagen. Elige otra.');
    } finally {
      this.readingImage.set(false);
    }
  }
  removeImage() {
    this.reviewed.set(false);
    this.image.set(null);
    this.imageName.set('');
    this.form.markAsDirty();
  }
  updateText() {
    this.text.set(this.form.controls.text.value);
  }
  private showError(e: { error?: { message?: string } }, fallback: string) {
    this.error.set(e.error?.message || fallback);
  }
}
