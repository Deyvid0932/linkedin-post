import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CredentialService } from '../../core/services/credential.service';
import {
  GitHubQueuePost,
  GitHubQueueService,
  GitHubQueueSnapshot,
} from '../../core/services/github-queue.service';
import { GitHubRepo } from '../../core/models/credential.model';

type CalendarMode = 'week' | 'month' | 'list';
interface CalendarDay {
  date: Date;
  key: string;
  inMonth: boolean;
  today: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent implements OnInit {
  private readonly credentials = inject(CredentialService);
  private readonly queueService = inject(GitHubQueueService);
  readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  readonly weekNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly repositories = signal<GitHubRepo[]>([]);
  readonly repositoryId = signal('');
  readonly snapshot = signal<GitHubQueueSnapshot | null>(null);
  readonly posts = computed(() => this.snapshot()?.posts || []);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly mode = signal<CalendarMode>('week');
  readonly selectedPost = signal<GitHubQueuePost | null>(null);
  readonly scheduleValue = signal('');
  readonly cursor = signal(
    new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
  );
  readonly periodLabel = computed(() =>
    this.mode() === 'month'
      ? this.cursor().toLocaleDateString('es', { month: 'long', year: 'numeric' })
      : this.mode() === 'week'
        ? this.weekRangeLabel()
        : 'Todas las fechas de la cola',
  );

  ngOnInit(): void {
    this.credentials.getMonitoredRepos().subscribe({
      next: (repos) => {
        this.repositories.set(repos.filter((repo) => repo.isActive));
        if (!this.repositoryId() && repos.length) {
          this.repositoryId.set(repos[0].id);
          this.load();
        }
      },
      error: () => this.error.set('No pudimos cargar tus repositorios. Revisa Canales → GitHub.'),
    });
  }

  selectRepository(id: string): void {
    this.repositoryId.set(id);
    this.snapshot.set(null);
    this.load();
  }
  load(): void {
    const id = this.repositoryId();
    if (!id) return;
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    this.queueService
      .load(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (snapshot) => this.snapshot.set(snapshot),
        error: (response) =>
          this.error.set(
            response?.status === 404
              ? 'No encontramos una cola en la rama predeterminada.'
              : 'No pudimos leer la cola y sus recibos de GitHub. Comprueba el PAT y vuelve a intentar.',
          ),
      });
  }

  move(delta: number): void {
    const current = this.cursor();
    const next = new Date(current);
    if (this.mode() === 'month') next.setMonth(next.getMonth() + delta);
    else next.setDate(next.getDate() + delta * 7);
    this.cursor.set(next);
  }
  goToday(): void {
    this.cursor.set(new Date());
  }
  weekDays(): CalendarDay[] {
    const start = this.startOfWeek(this.cursor());
    return Array.from({ length: 7 }, (_, i) =>
      this.day(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), true),
    );
  }
  monthDays(): CalendarDay[] {
    const first = new Date(this.cursor().getFullYear(), this.cursor().getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return this.day(date, date.getMonth() === first.getMonth());
    });
  }
  postsFor(day: CalendarDay): GitHubQueuePost[] {
    return this.posts().filter(
      (post) => post.publishAt && this.key(new Date(post.publishAt)) === day.key,
    );
  }
  canReschedule(post: GitHubQueuePost): boolean {
    return post.status === 'SCHEDULED' && !!post.publishAt && !post.attemptedAt;
  }
  statusLabel(status: string): string {
    return (
      (
        {
          SCHEDULED: 'Previsto',
          SUCCESS: 'Publicado confirmado',
          SENDING: 'Envío en curso',
          UNKNOWN: 'Revisar resultado',
          INVALID_DATE: 'Fecha inválida',
          UNAPPROVED: 'No aprobado',
        } as Record<string, string>
      )[status] || status
    );
  }
  statusClass(status: string): string {
    return status === 'SUCCESS'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
      : status === 'UNKNOWN' || status === 'SENDING'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
        : status === 'INVALID_DATE' || status === 'UNAPPROVED'
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
          : 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-200';
  }
  edit(post: GitHubQueuePost): void {
    if (!this.canReschedule(post)) return;
    this.selectedPost.set(post);
    this.scheduleValue.set(this.toLocalDateTime(new Date(post.publishAt!)));
  }
  startDrag(post: GitHubQueuePost, event: DragEvent): void {
    if (!this.canReschedule(post)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData('text/plain', post.id);
  }
  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }
  dropOn(date: Date, event: DragEvent): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain');
    const post = this.posts().find((item) => item.id === id);
    if (!post || !this.canReschedule(post)) return;
    const old = new Date(post.publishAt!);
    date.setHours(old.getHours(), old.getMinutes(), 0, 0);
    this.selectedPost.set(post);
    this.scheduleValue.set(this.toLocalDateTime(date));
  }
  saveSchedule(): void {
    const post = this.selectedPost();
    const snapshot = this.snapshot();
    const value = this.scheduleValue();
    if (!post || !snapshot || !this.canReschedule(post) || !value || this.saving()) return;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      this.error.set('La nueva fecha tiene que estar en el futuro.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.queueService
      .schedule(
        snapshot.repositoryId,
        post.id,
        date.toISOString(),
        this.timezone,
        snapshot.revision,
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.snapshot.set(result.queue);
          this.selectedPost.set(null);
          this.message.set('Fecha guardada en GitHub.');
        },
        error: (response) => {
          this.error.set(
            response?.status === 409
              ? 'La cola cambió o Actions reservó el envío. Recarga para ver el estado actualizado.'
              : 'No se guardó el cambio. El texto y la imagen siguen en GitHub; revisa la conexión y vuelve a cargar.',
          );
          if (response?.status === 409) this.load();
        },
      });
  }
  minimumDate(): string {
    return this.toLocalDateTime(new Date(Date.now() + 60_000));
  }
  private day(date: Date, inMonth: boolean): CalendarDay {
    const today = new Date();
    return { date, key: this.key(date), inMonth, today: this.key(date) === this.key(today) };
  }
  private key(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  private startOfWeek(date: Date): Date {
    const value = new Date(date);
    value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
    return value;
  }
  private weekRangeLabel(): string {
    const start = this.startOfWeek(this.cursor());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString('es', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  private toLocalDateTime(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }
}
