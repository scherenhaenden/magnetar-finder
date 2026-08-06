import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UniqueGroup } from '../types';

@Component({
  selector: 'app-analysis-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="ml-[280px] pt-16 h-screen overflow-hidden flex flex-col bg-surface text-on-surface">
      <!-- Page Header & Global Controls -->
      <div class="px-8 py-6 border-b border-outline-variant bg-surface-container-lowest shrink-0">
        <div class="flex items-end justify-between">
          <div>
            <h2 class="font-headline-md text-headline-md text-on-surface mb-1">Uniques &amp; Frequencies</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Isolate repeating patterns and chronological clusters within the dataset.</p>
          </div>
          <!-- Grouping Control -->
          <div class="flex items-center gap-3">
            <label class="font-label-caps text-label-caps text-on-surface-variant">Group by Field:</label>
            <div class="relative">
              <select
                [(ngModel)]="groupByField"
                class="appearance-none bg-surface-container tech-border rounded py-1.5 pl-3 pr-8 font-data-mono text-data-mono text-primary-fixed-dim focus:outline-none focus:border-primary-fixed cursor-pointer"
              >
                <option value="url">Source_URL</option>
                <option value="ip">Origin_IP</option>
                <option value="signature">Spectral_Signature</option>
                <option value="magnitude">Magnitude_Class</option>
              </select>
              <span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-primary-fixed-dim pointer-events-none text-[16px]">arrow_drop_down</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bento Grid Layout -->
      <div class="flex-1 p-8 overflow-hidden flex gap-6">
        <!-- LEFT COLUMN: Data Table (Uniques List) -->
        <div class="w-1/3 flex flex-col bg-surface-container tech-border rounded-lg overflow-hidden relative">
          <div class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary-fixed-dim/50 to-transparent"></div>
          <div class="p-4 border-b border-outline-variant bg-surface-container-highest flex justify-between items-center shrink-0">
            <h3 class="font-label-caps text-label-caps text-on-surface">Extracted Values</h3>
            <span class="font-data-mono text-[11px] text-on-surface-variant">Total Unique: 1,402</span>
          </div>
          <div class="flex-1 overflow-y-auto bg-surface-container-lowest">
            <table class="w-full text-left border-collapse">
              <thead class="sticky top-0 bg-surface-container/95 backdrop-blur-sm z-10 border-b border-outline-variant">
                <tr>
                  <th class="py-2 px-4 font-label-caps text-[10px] text-on-surface-variant w-3/5">Value</th>
                  <th class="py-2 px-4 font-label-caps text-[10px] text-on-surface-variant text-right">Count</th>
                </tr>
              </thead>
              <tbody class="font-data-mono text-data-mono divide-y divide-outline-variant/30">
                @for (group of uniquesGroups; track group.id) {
                  <tr
                    (click)="selectGroup.emit(group)"
                    [class]="selectedGroup.value === group.value ? 'table-row-active border-l-[3px] border-primary-fixed-dim text-primary-fixed-dim' : 'table-row-hover border-l-[3px] border-transparent text-on-surface-variant'"
                    class="cursor-pointer transition-colors group"
                  >
                    <td class="py-3 px-4 truncate max-w-[180px]" [title]="group.value">
                      {{ group.value }}
                    </td>
                    <td class="py-3 px-4 text-right text-on-surface">
                      {{ group.count | number }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- RIGHT COLUMN: Detail Stage (Bento Stack) -->
        <div class="w-2/3 flex flex-col gap-6">
          <!-- Top Detail Panel: Visualization & Actions -->
          <div class="bg-surface-container tech-border rounded-lg p-6 flex flex-col gap-6 shrink-0 relative overflow-hidden glow-active">
            <div class="flex justify-between items-start">
              <div>
                <div class="font-label-caps text-label-caps text-primary-fixed-dim mb-1">Selected Value</div>
                <div class="font-data-mono text-headline-md text-on-surface">{{ selectedGroup.value }}</div>
                @if (selectedGroup.label) {
                  <p class="font-body-sm text-[12px] text-on-surface-variant mt-1">{{ selectedGroup.label }}</p>
                }
              </div>
              <button
                (click)="scrollToNotes()"
                class="px-4 py-2 bg-transparent border border-primary-fixed-dim text-primary-fixed-dim hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-all rounded font-label-caps text-label-caps flex items-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]">edit_note</span>
                Link to Notes
              </button>
            </div>

            <!-- Frequency Visualization -->
            <div class="pt-4 border-t border-outline-variant">
              <div class="flex justify-between text-[11px] font-data-mono text-on-surface-variant mb-2">
                <span>Frequency Distribution (30 Days)</span>
                <span>Peak: {{ selectedGroup.peakDailyRate }}</span>
              </div>
              <div class="flex items-end gap-1 h-16 w-full opacity-80">
                @for (bar of selectedGroup.distributionBars; track $index) {
                  <div
                    class="flex-1 bg-primary-fixed-dim/30 hover:bg-primary-fixed-dim transition-colors rounded-t relative group"
                    [style.height.%]="(bar / maxBar) * 100"
                  >
                    <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] font-data-mono px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                      {{ bar }} events
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Bottom Panels: Split 50/50 -->
          <div class="flex gap-6 flex-1 min-h-0">
            <!-- Chronological Timeline -->
            <div class="flex-1 bg-surface-container tech-border rounded-lg flex flex-col overflow-hidden">
              <div class="p-4 border-b border-outline-variant bg-surface-container-highest shrink-0">
                <h3 class="font-label-caps text-label-caps text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">history</span>
                  Chronological Events
                </h3>
              </div>
              <div class="flex-1 overflow-y-auto p-6 relative">
                <div class="absolute left-[39px] top-6 bottom-6 w-px bg-outline-variant/50"></div>
                <div class="flex flex-col gap-6">
                  @for (evt of selectedGroup.timelineEvents; track evt.id) {
                    <div class="flex items-start gap-4 relative z-10 group">
                      <div class="w-10 pt-1 shrink-0 text-right">
                        <span class="font-data-mono text-[10px] text-on-surface-variant">{{ evt.time }}</span>
                      </div>
                      <div
                        [class]="evt.nodeType === 'highlight' ? 'bg-primary-fixed-dim shadow-[0_0_8px_rgba(0,219,231,0.5)]' : evt.nodeType === 'warning' ? 'bg-tertiary-fixed-dim' : 'bg-surface border border-outline-variant group-hover:border-primary-fixed-dim'"
                        class="w-3 h-3 mt-1.5 shrink-0 rotate-45 transition-colors"
                      ></div>
                      <div class="flex-1 bg-surface-container-low border border-outline-variant/50 p-3 rounded hover:border-primary-fixed-dim/50 transition-colors">
                        <div class="font-data-mono text-xs text-primary-fixed-dim mb-1">{{ evt.title }}</div>
                        <div class="font-body-sm text-[12px] text-on-surface-variant">{{ evt.description }}</div>
                      </div>
                    </div>
                  }
                  @if (selectedGroup.timelineEvents.length === 0) {
                    <div class="text-on-surface-variant font-data-mono text-xs italic">No timeline events recorded.</div>
                  }
                </div>
              </div>
            </div>

            <!-- Notes Attachment Interface -->
            <div id="notes-section" class="flex-1 bg-surface-container tech-border rounded-lg flex flex-col overflow-hidden">
              <div class="p-4 border-b border-outline-variant bg-surface-container-highest shrink-0">
                <h3 class="font-label-caps text-label-caps text-on-surface flex items-center gap-2">
                  <span class="material-symbols-outlined text-[16px]">sticky_note_2</span>
                  Analytical Notes
                </h3>
              </div>
              <div class="p-4 flex-1 flex flex-col bg-surface-container-lowest">
                <div class="mb-3">
                  <label class="font-label-caps text-[10px] text-on-surface-variant block mb-1.5">Target Group</label>
                  <div class="px-3 py-1.5 bg-surface border border-outline-variant rounded inline-flex items-center gap-2 font-data-mono text-xs text-primary-fixed-dim">
                    {{ selectedGroup.value }}
                  </div>
                </div>
                <textarea
                  [(ngModel)]="noteText"
                  (keyup.enter)="handleAddNote()"
                  class="flex-1 w-full bg-surface-container border border-outline-variant rounded p-3 font-body-sm text-sm text-on-surface placeholder:text-on-surface-variant/40 resize-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none mb-3"
                  placeholder="Enter observations regarding this frequency cluster. Use markdown for structuring..."
                ></textarea>
                <div class="flex justify-end gap-3 shrink-0">
                  <button (click)="noteText = ''" class="px-4 py-2 text-on-surface-variant hover:text-on-surface font-label-caps text-label-caps transition-colors cursor-pointer">Cancel</button>
                  <button (click)="handleAddNote()" class="px-5 py-2 bg-primary-fixed-dim text-on-primary-fixed font-label-caps text-label-caps rounded hover:bg-primary-fixed transition-colors shadow-[0_0_15px_rgba(0,219,231,0.2)] cursor-pointer">Save Note</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  `
})
export class AnalysisViewComponent {
  @Input({ required: true }) uniquesGroups!: UniqueGroup[];
  @Input({ required: true }) selectedGroup!: UniqueGroup;

  @Output() selectGroup = new EventEmitter<UniqueGroup>();
  @Output() saveNote = new EventEmitter<{ groupValue: string; noteText: string }>();

  groupByField = 'url';
  noteText = '';

  get maxBar(): number {
    return Math.max(...(this.selectedGroup?.distributionBars ?? [1]));
  }

  handleAddNote() {
    if (this.noteText.trim()) {
      this.saveNote.emit({ groupValue: this.selectedGroup.value, noteText: this.noteText.trim() });
      this.noteText = '';
    }
  }

  scrollToNotes() {
    document.getElementById('notes-section')?.scrollIntoView({ behavior: 'smooth' });
  }
}
