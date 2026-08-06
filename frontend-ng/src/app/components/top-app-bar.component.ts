import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-top-app-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="hidden md:flex h-16 w-full border-b border-outline-variant bg-surface-dim/95 backdrop-blur-sm fixed top-0 right-0 left-[280px] z-30 items-center justify-between px-6">
      <!-- Navigation Links -->
      <div class="flex items-center gap-2 h-full">
        @for (sub of subTabs; track sub) {
          <button
            (click)="selectSubTab.emit(sub)"
            [class]="getSubTabClass(sub)"
          >
            {{ sub }}
          </button>
        }
      </div>

      <!-- Actions & Search -->
      <div class="flex items-center gap-4">
        <!-- Quick Search -->
        <div class="relative w-72">
          <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" style="font-size: 16px;">search</span>
          <input
            type="text"
            [ngModel]="searchQuery"
            (ngModelChange)="searchChange.emit($event)"
            (keyup.enter)="executeQuery.emit()"
            placeholder="Query gamma ray burst..."
            class="w-full bg-surface-container-lowest border border-outline-variant rounded py-1 pl-8 pr-3 font-data-mono text-data-mono text-on-surface placeholder-on-surface-variant/50 focus:border-primary-fixed-dim focus:outline-none transition-colors"
          />
        </div>

        <button
          (click)="executeQuery.emit()"
          [disabled]="isExecuting"
          class="bg-surface-container-high border border-primary-fixed-dim/30 hover:border-primary-fixed-dim text-primary-fixed font-label-caps text-label-caps py-1.5 px-4 rounded transition-colors duration-150 flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {{ isExecuting ? 'Executing...' : 'Execute Query' }}
          <span class="material-symbols-outlined" style="font-size: 16px;">
            {{ isExecuting ? 'sync' : 'arrow_forward' }}
          </span>
        </button>

        <div class="flex items-center gap-1 border-l border-outline-variant pl-4">
          <button class="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer" title="Notifications">
            <span class="material-symbols-outlined" style="font-size: 20px;">notifications</span>
          </button>
          <button class="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer" title="Cloud Sync">
            <span class="material-symbols-outlined" style="font-size: 20px;">cloud_sync</span>
          </button>
          <button class="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer" title="Help">
            <span class="material-symbols-outlined" style="font-size: 20px;">help</span>
          </button>
        </div>
      </div>
    </header>
  `
})
export class TopAppBarComponent {
  @Input() searchQuery = '';
  @Input({ required: true }) activeSubTab!: string;
  @Input() isExecuting = false;

  @Output() searchChange = new EventEmitter<string>();
  @Output() selectSubTab = new EventEmitter<string>();
  @Output() executeQuery = new EventEmitter<void>();

  subTabs = ['Real-time', 'History', 'Signals'];

  getSubTabClass(sub: string): string {
    const base = 'h-full flex items-center font-label-caps text-label-caps px-4 transition-all cursor-pointer';
    return this.activeSubTab === sub
      ? `${base} text-primary-fixed border-b-2 border-primary-fixed font-bold`
      : `${base} text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md`;
  }
}
