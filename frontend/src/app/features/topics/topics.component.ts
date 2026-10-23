import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, SlicePipe } from '@angular/common';
import { TopicService, TopicTrendSignal } from '../../core/services/topic.service';
import { BackupTopic } from '../../core/models/topic.model';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { Subscription } from 'rxjs';

interface ExploredIdea {
  title: string;
  selected: boolean;
  alreadyInBank: boolean;
}

export function detectCategory(title: string): string {
  const t = title.toLowerCase();
  if (
    /\b(flutter|react native|android|ios|swift|swiftui|kotlin|mobile|dart|apk|xcode)\b/i.test(t)
  ) {
    return 'Móvil & Apps';
  }
  if (
    /\b(angular|react|vue|svelte|tailwind|css|html|typescript|javascript|next\.js|nuxt|vite|ui|ux|frontend|signals|rxjs)\b/i.test(
      t,
    )
  ) {
    return 'Frontend Web';
  }
  if (
    /\b(spring|java|spring boot|node|nodejs|express|python|fastapi|django|golang|go|docker|kubernetes|k8s|aws|microservicios|microservices|rest|api|grpc|kafka|rabbitmq|virtual threads)\b/i.test(
      t,
    )
  ) {
    return 'Backend & Cloud';
  }
  if (
    /\b(sql|mysql|postgres|postgresql|mongodb|redis|database|queries|query|jpa|hibernate|orm|índice|indices|dax|power bi|nosql)\b/i.test(
      t,
    )
  ) {
    return 'Base de Datos';
  }
  if (
    /\b(jwt|oauth|oauth2|seguridad|security|ciberseguridad|owasp|auth|encriptación|encryption|zero trust|vulnerabilidad|tokens|penetration|pentesting)\b/i.test(
      t,
    )
  ) {
    return 'Ciberseguridad';
  }
  if (
    /\b(arquitectura|architecture|clean code|clean architecture|patrones|design patterns|junior|senior|tech lead|carrera|entrevista|entrevistas|git|github|ci\/cd|devops)\b/i.test(
      t,
    )
  ) {
    return 'Arquitectura & Carrera';
  }
  return 'General Tech';
}

@Component({
  selector: 'app-topics',
  standalone: true,
  imports: [FormsModule, DatePipe, SlicePipe, DialogComponent, RouterLink],
  templateUrl: './topics.component.html',
})
export class TopicsComponent implements OnInit, OnDestroy {
  private topicService = inject(TopicService);
  private router = inject(Router);

  topics = signal<BackupTopic[]>([]);
  togglingTopicId = signal<string | null>(null);
  openingTopicId = signal<string | null>(null);
  filterMode = signal<'ALL' | 'AVAILABLE' | 'INVESTIGATED'>('ALL');
  searchQuery = signal('');
  isInputExpanded = signal(false);
  rawInputText = '';
  saving = signal(false);
  feedbackNotice = signal<string | null>(null);
  topicsLoading = signal(false);
  topicsLoadFailed = signal(false);
  activeMode = signal<'bank' | 'explore'>('bank');

  showClearAllModal = signal(false);
  clearingAll = signal(false);
  topicToDelete = signal<BackupTopic | null>(null);
  explorationNiche = '';
  exploring = signal(false);
  exploredIdeas = signal<ExploredIdea[]>([]);
  explorationError = signal<string | null>(null);
  savingExploredIdeas = signal(false);
  selectedExploredIdeas = computed(() => this.exploredIdeas().filter((idea) => idea.selected));
  recentSignals = signal<TopicTrendSignal[]>([]);
  readonly trendCategories = [
    'Móvil & Apps',
    'Frontend Web',
    'Backend & Cloud',
    'Base de Datos',
    'Ciberseguridad',
    'Arquitectura & Carrera',
    'General Tech',
  ];
  signalsPeriod = signal<'24h' | '7d' | '30d'>('7d');
  signalCategory = signal('ALL');
  loadingSignals = signal(false);
  signalsError = signal<string | null>(null);
  signalsSource = signal<string | null>(null);
  signalsFetchedAt = signal<string | null>(null);
  signalsNiche = signal<string | null>(null);
  hasSearchedSignals = signal(false);
  savingSignalId = signal<string | null>(null);
  signalSaveErrorId = signal<string | null>(null);
  private signalsRequest?: Subscription;

  filteredRecentSignals = computed(() => {
    const category = this.signalCategory();
    const signals = this.recentSignals();
    return category === 'ALL'
      ? signals
      : signals.filter((signal) => detectCategory(signal.title) === category);
  });
  signalSummary = computed(() => ({
    count: this.filteredRecentSignals().length,
    points: this.filteredRecentSignals().reduce((sum, signal) => sum + signal.points, 0),
    comments: this.filteredRecentSignals().reduce((sum, signal) => sum + signal.comments, 0),
  }));
  signalsWindowLabel = computed(() => {
    switch (this.signalsPeriod()) {
      case '24h': return 'últimas 24 horas';
      case '30d': return 'últimos 30 días';
      default: return 'últimos 7 días';
    }
  });

  countAvailable = computed(() => this.topics().filter((i) => !i.isUsed).length);
  countInvestigated = computed(() => this.topics().filter((i) => !!i.isUsed).length);
  categoryCount = computed(
    () => new Set(this.topics().map((topic) => topic.category?.trim() || 'General Tech')).size,
  );
  categoryBreakdown = computed(() => {
    const counts = new Map<string, number>();
    for (const topic of this.topics()) {
      const category = topic.category?.trim() || 'General Tech';
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);
  });
  reorderEnabled = computed(() => this.filterMode() === 'ALL' && !this.searchQuery().trim());

  filteredTopics = computed(() => {
    let list = this.topics();
    const mode = this.filterMode();

    if (mode === 'AVAILABLE') {
      list = list.filter((i) => !i.isUsed);
    } else if (mode === 'INVESTIGATED') {
      list = list.filter((i) => !!i.isUsed);
    }

    if (this.searchQuery().trim()) {
      const q = this.searchQuery().toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) || (i.category && i.category.toLowerCase().includes(q)),
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.loadTopics();
  }

  ngOnDestroy(): void {
    this.signalsRequest?.unsubscribe();
  }

  categoryForSignal(title: string): string {
    return detectCategory(title);
  }

  dismissMenu(event: Event): void {
    (event.currentTarget as HTMLElement | null)?.closest('details')?.removeAttribute('open');
  }

  loadTopics(): void {
    this.topicsLoading.set(true);
    this.topicsLoadFailed.set(false);
    this.topicService.getTopics().subscribe({
      next: (list) => {
        this.topics.set(list || []);
        this.topicsLoading.set(false);
        this.topicsLoadFailed.set(false);
        if (this.feedbackNotice() === 'No pudimos cargar las ideas. Pulsa Reintentar para volver a intentarlo.') {
          this.feedbackNotice.set(null);
        }
      },
      error: () => {
        this.topicsLoading.set(false);
        this.topicsLoadFailed.set(true);
        this.feedbackNotice.set(
          'No pudimos cargar las ideas. Pulsa Reintentar para volver a intentarlo.',
        );
      },
    });
  }

  submitSmartIdeas(): void {
    if (!this.rawInputText.trim()) return;
    this.saving.set(true);
    this.feedbackNotice.set(null);

    const existingTitles = new Set(this.topics().map((t) => t.title.toLowerCase().trim()));

    const lines = this.rawInputText
      .split('\n')
      .map((l) => l.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter((l) => l.length > 0);

    const uniqueLines: string[] = [];
    let duplicatesCount = 0;

    for (const line of lines) {
      const normalized = line.toLowerCase();
      if (
        existingTitles.has(normalized) ||
        uniqueLines.some((ul) => ul.toLowerCase() === normalized)
      ) {
        duplicatesCount++;
      } else {
        uniqueLines.push(line);
      }
    }

    if (uniqueLines.length === 0) {
      this.saving.set(false);
      this.feedbackNotice.set(
        `Todos los temas ingresados (${duplicatesCount}) ya existen en el banco de ideas.`,
      );
      return;
    }

    const backupTopics = uniqueLines.map((line) => ({
      title: line,
      category: detectCategory(line),
      isAiResearch: false,
      priority: 0,
    }));

    this.topicService.addBulkTopics({ backupTopics, isAiResearchDefault: false }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.rawInputText = '';
        const msg =
          duplicatesCount > 0
            ? `Se agregaron ${uniqueLines.length} ideas nuevas (${duplicatesCount} omitidas por ser duplicadas).`
            : `Se agregaron ${uniqueLines.length} ideas exitosamente al banco.`;
        this.feedbackNotice.set(msg);
        this.loadTopics();
      },
      error: () => {
        this.saving.set(false);
        this.feedbackNotice.set(
          'No pudimos guardar las ideas. Tu texto sigue disponible para reintentar.',
        );
      },
    });
  }

  exploreNiche(): void {
    const niche = this.explorationNiche.trim();
    if (!niche || this.exploring()) return;
    this.exploring.set(true);
    this.explorationError.set(null);
    this.exploredIdeas.set([]);
    this.topicService.exploreIdeas(niche).subscribe({
      next: (response) => {
        const existing = new Set(this.topics().map((topic) => topic.title.trim().toLocaleLowerCase()));
        this.exploredIdeas.set(
          (response.ideas || []).map((title) => {
            const alreadyInBank = existing.has(title.trim().toLocaleLowerCase());
            return { title, alreadyInBank, selected: !alreadyInBank };
          }),
        );
        this.exploring.set(false);
        if (!response.ideas?.length) {
          this.explorationError.set('La IA no devolvió propuestas. Puedes intentarlo de nuevo.');
        }
      },
      error: () => {
        this.exploring.set(false);
        this.explorationError.set('No se pudieron generar ideas. Revisa la conexión del proveedor e inténtalo de nuevo.');
      },
    });
  }

  searchRecentSignals(): void {
    const niche = this.explorationNiche.trim();
    if (!niche) return;
    this.signalsRequest?.unsubscribe();
    this.hasSearchedSignals.set(true);
    this.loadingSignals.set(true);
    this.signalsError.set(null);
    this.recentSignals.set([]);
    this.signalsSource.set(null);
    this.signalsFetchedAt.set(null);
    this.signalsNiche.set(null);
    this.signalsRequest = this.topicService.getRecentSignals(niche, this.signalsPeriod()).subscribe({
      next: (response) => {
        this.recentSignals.set(response.signals || []);
        this.signalsSource.set(response.source);
        this.signalsFetchedAt.set(response.fetchedAt);
        this.signalsNiche.set(response.niche);
        this.loadingSignals.set(false);
        this.signalsRequest = undefined;
      },
      error: () => {
        this.loadingSignals.set(false);
        this.signalsError.set('No pudimos consultar Hacker News. Las propuestas de IA siguen disponibles.');
        this.signalsRequest = undefined;
      },
    });
  }

  setSignalsPeriod(period: string): void {
    if (period !== '24h' && period !== '7d' && period !== '30d') return;
    if (period === this.signalsPeriod()) return;
    this.signalsPeriod.set(period);
    if (this.hasSearchedSignals()) this.searchRecentSignals();
  }

  signalAlreadySaved(signal: TopicTrendSignal): boolean {
    return this.topics().some((topic) => topic.title.trim().toLocaleLowerCase() === signal.title.trim().toLocaleLowerCase());
  }

  saveSignal(signal: TopicTrendSignal): void {
    if (this.signalAlreadySaved(signal) || this.savingSignalId()) return;
    this.savingSignalId.set(signal.id);
    this.signalSaveErrorId.set(null);
    this.topicService.addTopic({
      title: signal.title,
      category: detectCategory(signal.title),
      description: `Señal de Hacker News del ${new Date(signal.createdAt).toLocaleString()}. ${signal.points} puntos y ${signal.comments} comentarios.`,
      isAiResearch: true,
      priority: 0,
    }).subscribe({
      next: (saved) => {
        this.savingSignalId.set(null);
        this.signalSaveErrorId.set(null);
        this.topics.update((list) => [saved, ...list]);
        this.feedbackNotice.set('La señal se guardó como idea para revisión.');
      },
      error: () => {
        this.savingSignalId.set(null);
        this.signalSaveErrorId.set(signal.id);
      },
    });
  }

  toggleExploredIdea(title: string): void {
    this.exploredIdeas.update((ideas) => ideas.map((idea) =>
      idea.title === title && !idea.alreadyInBank ? { ...idea, selected: !idea.selected } : idea,
    ));
  }

  saveExploredIdeas(): void {
    const selected = this.selectedExploredIdeas().filter((idea) => !idea.alreadyInBank);
    if (!selected.length || this.savingExploredIdeas()) return;

    this.savingExploredIdeas.set(true);
    this.topicService.addBulkTopics({
      backupTopics: selected.map(({ title }) => ({
        title,
        category: detectCategory(title),
        isAiResearch: true,
        priority: 0,
      })),
      isAiResearchDefault: true,
    }).subscribe({
      next: () => {
        const savedTitles = new Set(selected.map((idea) => idea.title));
        this.exploredIdeas.update((ideas) => ideas.map((idea) => savedTitles.has(idea.title)
          ? { ...idea, selected: false, alreadyInBank: true }
          : idea,
        ));
        this.savingExploredIdeas.set(false);
        this.feedbackNotice.set(`Se guardaron ${selected.length} ideas seleccionadas en el banco.`);
        this.loadTopics();
      },
      error: () => {
        this.savingExploredIdeas.set(false);
        this.explorationError.set('No se pudieron guardar las propuestas. Siguen seleccionadas para reintentar.');
      },
    });
  }

  movePriority(id: string, direction: number): void {
    if (!this.reorderEnabled()) return;

    const previous = this.topics();
    const index = previous.findIndex((item) => item.id === id);
    if (index < 0) return;
    const list = [...this.topics()];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    const temp = list[index];
    list[index] = list[target];
    list[target] = temp;

    this.topics.set(list);

    const reorderPayload = list.map((item, idx) => ({
      id: item.id,
      priority: list.length - idx,
    }));

    this.topicService.reorderTopics(reorderPayload).subscribe({
      error: () => {
        this.topics.set(previous);
        this.feedbackNotice.set('No se pudo cambiar el orden. Puedes intentarlo otra vez.');
      },
    });
  }

  confirmDelete(): void {
    const item = this.topicToDelete();
    if (!item) return;

    this.topicToDelete.set(null);
    this.topicService.deleteTopic(item.id).subscribe({
      next: () => this.topics.update((list) => list.filter((t) => t.id !== item.id)),
      error: () => {
        this.feedbackNotice.set(
          'No se pudo eliminar la idea. Se conserva hasta confirmar el resultado.',
        );
        this.loadTopics();
      },
    });
  }

  toggleUsed(item: BackupTopic): void {
    if (this.togglingTopicId()) return;
    this.togglingTopicId.set(item.id);
    this.topicService.toggleTopicUsed(item.id).subscribe({
      next: (updated) => {
        this.togglingTopicId.set(null);
        this.topics.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
      },
      error: () => {
        this.togglingTopicId.set(null);
        this.feedbackNotice.set(
          'No pudimos actualizar el estado de esta idea. Inténtalo de nuevo.',
        );
        this.loadTopics();
      },
    });
  }

  openInStudio(item: BackupTopic): void {
    this.openingTopicId.set(item.id);
    this.router.navigate(['/studio'], { queryParams: { topic: item.title } });
  }

  confirmClearAll(): void {
    this.clearingAll.set(true);
    this.topicService.clearAllTopics().subscribe({
      next: () => {
        this.clearingAll.set(false);
        this.showClearAllModal.set(false);
        this.topics.set([]);
      },
      error: () => {
        this.clearingAll.set(false);
        this.feedbackNotice.set(
          'No se pudo vaciar el banco. Puedes reintentar; las ideas siguen en el servidor.',
        );
        this.loadTopics();
      },
    });
  }
}
