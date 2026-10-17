import { Component, OnInit, inject, signal } from '@angular/core';
import { PublicationService } from '../../../core/services/publication.service';
import { GeneratedPreview } from '../../../core/models/publication.model';

@Component({
  selector: 'app-preview',
  standalone: true,
  templateUrl: './preview.component.html',
})
export class PreviewComponent implements OnInit {
  private publicationService = inject(PublicationService);

  loading = signal(true);
  publishing = signal(false);
  preview = signal<GeneratedPreview | null>(null);
  alertMessage = signal<string | null>(null);
  customImage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPreview();
  }

  loadPreview(): void {
    this.loading.set(true);
    this.alertMessage.set(null);
    this.customImage.set(null);

    this.publicationService.getPreview().subscribe({
      next: (data) => {
        this.preview.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error obteniendo preview:', err);
        this.loading.set(false);
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.customImage.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  approveAndPublish(): void {
    this.publishing.set(true);
    this.alertMessage.set(null);

    const text = this.preview()?.generatedText;
    const img = this.customImage() || this.preview()?.imageUrl;

    this.publicationService.publishPreviewNow(text, img).subscribe({
      next: (res) => {
        this.publishing.set(false);
        this.alertMessage.set(
          res?.message || '✅ Post aprobado y publicado exitosamente en tu perfil de LinkedIn.',
        );
      },
      error: (err) => {
        this.publishing.set(false);
        this.alertMessage.set(
          '❌ Error al publicar: ' + (err?.error?.message || 'Fallo de conexión con LinkedIn'),
        );
        console.error('Error al publicar:', err);
      },
    });
  }
}
