import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseSource, SavedFinding } from '../types';

@Component({
  selector: 'app-database-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="ml-[280px] mt-16 p-8 h-[calc(100vh-64px)] overflow-y-auto bg-surface flex gap-6 text-on-surface">
      <!-- Left/Main Column: Databases & Saved Findings -->
      <div class="flex-1 flex flex-col gap-6">
        <!-- Database Management Section -->
        <section class="bg-surface-container rounded-lg border border-outline-variant overflow-hidden">
          <div class="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
            <h2 class="font-headline-md text-headline-md text-on-surface">Connected Databases</h2>
            <div class="flex gap-2">
              <button
                (click)="connectSqlite.emit()"
                class="px-3 py-1.5 border border-primary-fixed-dim text-primary-fixed-dim font-label-caps text-label-caps rounded hover:bg-primary-fixed-dim/10 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]">add_link</span>
                Connect SQLite
              </button>
            </div>
          </div>
          <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (db of databases; track db.id) {
              <div
                [class]="db.connected ? 'bg-surface-container-low border border-outline-variant hover:border-primary-fixed-dim/50' : 'bg-surface-container-low border border-outline-variant opacity-70 grayscale'"
                class="rounded p-4 transition-colors group flex flex-col justify-between"
              >
                <div>
                  <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-primary-fixed-dim" style="font-variation-settings: 'FILL' 1;">dataset</span>
                      <h3 class="font-body-lg text-body-lg text-on-surface font-semibold truncate max-w-[160px]">{{ db.name }}</h3>
                    </div>
                    <span
                      [class]="db.connected ? 'bg-primary-fixed-dim shadow-[0_0_8px_rgba(0,219,231,0.6)]' : 'bg-outline'"
                      class="w-2 h-2 rounded-full mt-1 shrink-0"
                    ></span>
                  </div>
                  <div class="font-data-mono text-data-mono text-on-surface-variant flex flex-col gap-1 mb-4">
                    <span>Size: {{ db.size }}</span>
                    <span>Records: {{ db.records }}</span>
                    <span>Last Sync: {{ db.lastSync }}</span>
                  </div>
                </div>
                <div class="flex gap-2 border-t border-outline-variant pt-3">
                  <button
                    (click)="toggleBookmark.emit(db.id)"
                    class="flex-1 text-center py-1 text-on-surface hover:text-primary-fixed-dim font-label-caps text-label-caps transition-colors cursor-pointer"
                  >
                    {{ db.connected ? 'Disconnect' : 'Connect' }}
                  </button>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Saved Findings Repository Section -->
        <section class="bg-surface-container rounded-lg border border-outline-variant overflow-hidden flex-1 flex flex-col">
          <div class="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
            <h2 class="font-headline-md text-headline-md text-on-surface">Saved Findings Repository</h2>
            <div class="flex gap-2 bg-surface-container-highest rounded border border-outline-variant p-1">
              <button class="px-3 py-1 bg-surface-container text-on-surface font-label-caps text-label-caps rounded border border-outline-variant shadow-sm cursor-pointer">Table View</button>
              <button class="px-3 py-1 text-on-surface-variant hover:text-on-surface font-label-caps text-label-caps rounded transition-colors cursor-pointer">File Tree</button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse data-table">
              <thead class="bg-surface-container-lowest border-b border-outline-variant sticky top-0 backdrop-blur-md bg-opacity-90">
                <tr>
                  <th class="px-4 py-3 font-label-caps text-label-caps text-on-surface-variant font-semibold w-12"></th>
                  <th class="px-4 py-3 font-label-caps text-label-caps text-on-surface-variant font-semibold">Event ID</th>
                  <th class="px-4 py-3 font-label-caps text-label-caps text-on-surface-variant font-semibold">Type</th>
                  <th class="px-4 py-3 font-label-caps text-label-caps text-on-surface-variant font-semibold">Magnitude</th>
                  <th class="px-4 py-3 font-label-caps text-label-caps text-on-surface-variant font-semibold">Custom Note / Link</th>
                  <th class="px-4 py-3 font-label-caps text-label-caps text-on-surface-variant font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="font-data-mono text-data-mono text-on-surface">
                @for (finding of savedFindings; track finding.id) {
                  <tr class="border-b border-outline-variant/50 hover:bg-surface-container-highest/20 cursor-pointer">
                    <td class="px-4 py-3 text-center">
                      <span
                        (click)="toggleBookmark.emit(finding.id)"
                        [class]="finding.bookmarked ? 'text-tertiary-fixed-dim' : 'text-outline hover:text-on-surface-variant'"
                        class="material-symbols-outlined text-[18px] cursor-pointer"
                      >
                        {{ finding.bookmarked ? 'bookmark' : 'bookmark_border' }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-primary-fixed-dim font-bold">{{ finding.eventId }}</td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-0.5 bg-secondary-container/50 text-secondary-fixed rounded text-[11px]">
                        {{ finding.type }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right pr-8">{{ finding.magnitude }}</td>
                    <td class="px-4 py-3 max-w-xs truncate text-on-surface-variant font-body-sm text-body-sm">
                      {{ finding.customNote }}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <button class="text-on-surface-variant hover:text-primary-fixed-dim transition-colors cursor-pointer">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Right Side Panel: Notes & Export -->
      <aside class="w-80 flex flex-col gap-6 shrink-0">
        <!-- Project Notes Panel -->
        <div class="bg-surface-container-low border border-outline-variant rounded-lg flex-1 flex flex-col">
          <div class="p-4 border-b border-outline-variant flex items-center justify-between">
            <h3 class="font-headline-md text-headline-md text-on-surface text-[18px]">Project Notes</h3>
            <button class="text-on-surface-variant hover:text-primary-fixed-dim transition-colors cursor-pointer">
              <span class="material-symbols-outlined text-[20px]">edit_document</span>
            </button>
          </div>
          <div class="p-4 flex-1 overflow-y-auto">
            <div class="prose prose-invert prose-sm max-w-none text-on-surface-variant font-body-sm text-body-sm">
              <p class="mb-4 text-on-surface"><strong>Current Focus:</strong> Correlating gamma-ray flare timings with radio pulsations in SGR 1806-20.</p>
              <ul class="list-disc pl-4 space-y-2 mb-4">
                <li>Check data alignment between satellite feeds.</li>
                <li>Run spectral analysis script on recent anomalies.</li>
                <li>Prepare preliminary figures for Friday meeting.</li>
              </ul>
              <div class="bg-surface-container p-3 border-l-2 border-tertiary-fixed-dim rounded font-data-mono text-[12px] text-tertiary-fixed-dim">
                &gt; Warning: Data gap detected in log range 44002-44010. Interpolation required before export.
              </div>
            </div>
          </div>
          <div class="p-4 border-t border-outline-variant bg-surface-container-highest/50">
            <textarea
              [(ngModel)]="newNote"
              rows="3"
              class="w-full bg-surface-container border border-outline-variant rounded p-2 text-on-surface font-body-sm text-body-sm focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim resize-none outline-none"
              placeholder="Quick add note..."
            ></textarea>
            <button
              (click)="handleAddNote()"
              class="w-full mt-2 py-1.5 bg-surface-bright text-on-surface font-label-caps text-label-caps rounded border border-outline-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              Append Note
            </button>
          </div>
        </div>

        <!-- Export Options -->
        <div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
          <h3 class="font-headline-md text-headline-md text-on-surface text-[16px] mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">export_notes</span>
            Export Configuration
          </h3>
          <div class="space-y-3 font-body-sm text-body-sm">
            <label class="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked class="form-checkbox bg-surface-container border-outline-variant text-primary-fixed-dim rounded focus:ring-primary-fixed-dim" />
              <span class="text-on-surface-variant group-hover:text-on-surface transition-colors">Include Saved Findings (.csv)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked class="form-checkbox bg-surface-container border-outline-variant text-primary-fixed-dim rounded focus:ring-primary-fixed-dim" />
              <span class="text-on-surface-variant group-hover:text-on-surface transition-colors">Generate README.md instructions</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" class="form-checkbox bg-surface-container border-outline-variant text-primary-fixed-dim rounded focus:ring-primary-fixed-dim" />
              <span class="text-on-surface-variant group-hover:text-on-surface transition-colors">Compress Build Folder (.tar.gz)</span>
            </label>
          </div>
          <div class="mt-6 border-t border-outline-variant pt-4">
            <button (click)="handleExport()" class="w-full py-2 bg-primary-fixed-dim text-on-primary-fixed font-label-caps text-label-caps rounded hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(0,219,231,0.2)] cursor-pointer">
              <span class="material-symbols-outlined text-[18px]">download</span>
              Export Build
            </button>
          </div>
        </div>
      </aside>
    </main>
  `
})
export class DatabaseViewComponent {
  @Input({ required: true }) databases!: DatabaseSource[];
  @Input({ required: true }) savedFindings!: SavedFinding[];

  @Output() toggleBookmark = new EventEmitter<string>();
  @Output() connectSqlite = new EventEmitter<void>();

  newNote = '';

  handleAddNote() {
    if (this.newNote.trim()) {
      alert(`Note added: ${this.newNote.trim()}`);
      this.newNote = '';
    }
  }

  handleExport() {
    alert('Exporting project data package...');
  }
}
