import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { TopicService } from '../../core/services/topic.service';
import { BackupTopic } from '../../core/models/topic.model';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';

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
  imports: [FormsModule, SlicePipe, DialogComponent, RouterLink],
  templateUrl: './topics.component.html',
})
export class TopicsComponent implements OnInit {
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

  showClearAllModal = signal(false);
  clearingAll = signal(false);
  topicToDelete = signal<BackupTopic | null>(null);

  countAvailable = computed(() => this.topics().filter((i) => !i.isUsed).length);
  countInvestigated = computed(() => this.topics().filter((i) => !!i.isUsed).length);
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

  dismissMenu(event: Event): void {
    (event.currentTarget as HTMLElement | null)?.closest('details')?.removeAttribute('open');
  }

  loadTopics(): void {
    this.topicsLoading.set(true);
    this.topicService.getTopics().subscribe({
      next: (list) => {
        this.topics.set(list || []);
        this.topicsLoading.set(false);
      },
      error: () => {
        this.topicsLoading.set(false);
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

  movePriority(id: string, direction: number): void {
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
