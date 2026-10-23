import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Subject, catchError, finalize, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AdminDailyPublicationOutcome,
  AdminDailyApiRequestCount,
  AdminDailyImageGeneration,
  AdminDailyTextUsage,
  AdminOverview,
  AdminService,
} from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.css',
})
export class AdminOverviewComponent implements OnInit {
  private readonly api = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly overviewQuery = new Subject<number>();

  readonly overview = signal<AdminOverview | null>(null);
  readonly loading = signal(true);
  readonly periodDays = signal<7 | 30 | 90>(30);
  readonly periods: readonly (7 | 30 | 90)[] = [7, 30, 90];
  readonly error = signal('');

  ngOnInit(): void {
    this.overviewQuery.pipe(
      switchMap((periodDays) => {
        this.loading.set(true);
        this.error.set('');
        return this.api.getOverview(periodDays).pipe(
          catchError((error: { error?: { message?: string } }) => {
            this.error.set(error.error?.message || 'No se pudieron cargar los datos administrativos.');
            return of(null);
          }),
          finalize(() => this.loading.set(false)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((overview) => {
      if (overview) this.overview.set(overview);
    });
    this.load();
  }

  setPeriod(periodDays: 7 | 30 | 90): void {
    if (this.periodDays() === periodDays) return;
    this.periodDays.set(periodDays);
    this.load();
  }

  load(): void {
    this.overviewQuery.next(this.periodDays());
  }

  usageBarHeight(tokens: number, entries: AdminDailyTextUsage[] | undefined): number {
    const highest = Math.max(0, ...(entries ?? []).map((entry) => Number.isFinite(entry.tokens) ? entry.tokens : 0));
    if (highest <= 0 || !Number.isFinite(tokens) || tokens <= 0) return 0;
    return Math.max(3, Math.min(100, (tokens / highest) * 100));
  }

  imageUsageBarHeight(count: number, entries: AdminDailyImageGeneration[] | undefined): number {
    const highest = Math.max(0, ...(entries ?? [])
      .filter((entry) => entry.tracked)
      .map((entry) => Number.isFinite(entry.successfulGenerations) ? entry.successfulGenerations : 0));
    if (highest <= 0 || !Number.isFinite(count) || count <= 0) return 0;
    return Math.max(3, Math.min(100, (count / highest) * 100));
  }

  hasTrackedImageGenerations(entries: AdminDailyImageGeneration[] | undefined): boolean {
    return Boolean(entries?.some((entry) => entry.tracked));
  }

  hasTrackedTextUsage(entries: AdminDailyTextUsage[] | undefined): boolean {
    return Boolean(entries?.some((entry) => entry.tracked));
  }

  usageDayLabel(isoDate: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    return match ? `${match[3]}/${match[2]}` : isoDate;
  }

  publicationBarHeight(count: number, entries: AdminDailyPublicationOutcome[] | undefined): number {
    const highest = Math.max(0, ...(entries ?? []).flatMap((entry) => [entry.published, entry.failed]));
    if (highest <= 0 || !Number.isFinite(count) || count <= 0) return 0;
    return Math.max(3, Math.min(100, (count / highest) * 100));
  }

  apiRequestBarHeight(count: number, entries: AdminDailyApiRequestCount[] | undefined): number {
    const highest = Math.max(0, ...(entries ?? [])
      .filter((entry) => entry.tracked)
      .map((entry) => entry.successful + entry.redirects + entry.clientErrors + entry.serverErrors));
    if (highest <= 0 || !Number.isFinite(count) || count <= 0) return 0;
    return Math.max(3, Math.min(100, (count / highest) * 100));
  }

  apiRequestTrendTotals(entries: AdminDailyApiRequestCount[]): {
    successful: number; redirects: number; clientErrors: number; serverErrors: number;
  } {
    return entries.filter((entry) => entry.tracked).reduce((totals, entry) => ({
      successful: totals.successful + this.nonNegative(entry.successful),
      redirects: totals.redirects + this.nonNegative(entry.redirects),
      clientErrors: totals.clientErrors + this.nonNegative(entry.clientErrors),
      serverErrors: totals.serverErrors + this.nonNegative(entry.serverErrors),
    }), { successful: 0, redirects: 0, clientErrors: 0, serverErrors: 0 });
  }

  apiRequestTrendLabel(entries: AdminDailyApiRequestCount[]): string {
    const totals = this.apiRequestTrendTotals(entries);
    const requests = totals.successful + totals.redirects + totals.clientErrors + totals.serverErrors;
    return `Solicitudes API registradas en ${entries.filter((entry) => entry.tracked).length} días: ${requests} en total, ${totals.successful} correctas, ${totals.redirects} redirecciones, ${totals.clientErrors} errores de cliente y ${totals.serverErrors} errores de servidor.`;
  }

  hasTrackedApiRequests(entries: AdminDailyApiRequestCount[] | undefined): boolean {
    return Boolean(entries?.some((entry) => entry.tracked));
  }

  private nonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  throttleBarHeight(count: number, entries: AdminOverview['dailyHttp429Responses']): number {
    const highest = Math.max(0, ...(entries ?? [])
      .filter((entry) => entry.tracked)
      .map((entry) => entry.auth + entry.ai + entry.api));
    if (highest <= 0 || !Number.isFinite(count) || count <= 0) return 0;
    return Math.max(3, Math.min(100, (count / highest) * 100));
  }

  throttleTrendTotals(entries: NonNullable<AdminOverview['dailyHttp429Responses']>): { auth: number; ai: number; api: number } {
    return entries.filter((entry) => entry.tracked).reduce((totals, entry) => ({
      auth: totals.auth + (Number.isFinite(entry.auth) ? Math.max(0, entry.auth) : 0),
      ai: totals.ai + (Number.isFinite(entry.ai) ? Math.max(0, entry.ai) : 0),
      api: totals.api + (Number.isFinite(entry.api) ? Math.max(0, entry.api) : 0),
    }), { auth: 0, ai: 0, api: 0 });
  }

  hasTrackedHttp429(entries: AdminOverview['dailyHttp429Responses']): boolean {
    return Boolean(entries?.some((entry) => entry.tracked));
  }

  throttleTrendLabel(entries: NonNullable<AdminOverview['dailyHttp429Responses']>): string {
    const totals = this.throttleTrendTotals(entries);
    const trackedDays = entries.filter((entry) => entry.tracked).length;
    const untrackedDays = entries.length - trackedDays;
    const untrackedLabel = untrackedDays === 1 ? '1 día sin registro disponible' : `${untrackedDays} días sin registro disponible`;
    return `Respuestas HTTP 429 en ${trackedDays} días observados: ${totals.auth} de autenticación, ${totals.ai} de IA y ${totals.api} de API. ${untrackedLabel}.`;
  }

  publicationTrendLabel(entries: AdminDailyPublicationOutcome[]): string {
    const totals = this.publicationTrendTotals(entries);
    return `Resultados diarios de publicación en ${entries.length} días: ${totals.published} confirmadas y ${totals.failed} fallidas.`;
  }

  publicationTrendTotals(entries: AdminDailyPublicationOutcome[]): { published: number; failed: number } {
    return entries.reduce((totals, entry) => ({
      published: totals.published + (Number.isFinite(entry.published) ? Math.max(0, entry.published) : 0),
      failed: totals.failed + (Number.isFinite(entry.failed) ? Math.max(0, entry.failed) : 0),
    }), { published: 0, failed: 0 });
  }

  activeAccountPercentage(activeUsers: number, totalUsers: number): number | null {
    if (
      !Number.isFinite(activeUsers) || !Number.isFinite(totalUsers) ||
      totalUsers <= 0 || activeUsers < 0 || activeUsers > totalUsers
    ) {
      return null;
    }
    return (activeUsers / totalUsers) * 100;
  }

  failedPublicationPercentage(failedPosts: number, publishedPosts: number): number | null {
    const totalResults = failedPosts + publishedPosts;
    if (
      !Number.isFinite(failedPosts) || !Number.isFinite(publishedPosts) ||
      failedPosts < 0 || publishedPosts < 0 || totalResults <= 0
    ) {
      return null;
    }
    return (failedPosts / totalResults) * 100;
  }
}
