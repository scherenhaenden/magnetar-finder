import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationTab } from '../types';

@Component({
  selector: 'app-side-nav-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="hidden md:flex flex-col w-[280px] h-screen border-r border-outline-variant bg-surface-container-lowest fixed left-0 top-0 bottom-0 z-40 overflow-y-auto select-none">
      <!-- Header -->
      <div class="px-6 py-6 border-b border-outline-variant/50">
        <div class="flex items-center gap-4 mb-6">
          <div class="w-10 h-10 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center overflow-hidden shrink-0">
            <div class="w-full h-full bg-[#00dbe7]/10 border border-[#00dbe7]/30 flex items-center justify-center text-[#00dbe7] font-mono font-bold text-[16px]">
              MF
            </div>
          </div>
          <div>
            <h1 class="font-headline-md text-headline-md font-bold tracking-tight text-primary-fixed leading-none">
              Magnetar Finder
            </h1>
            <p class="font-body-sm text-[12px] text-on-surface-variant mt-1">Precision Astrophysics</p>
          </div>
        </div>

        <button
          (click)="openNewAnalysis.emit()"
          class="w-full bg-primary-fixed-dim hover:bg-primary-fixed text-on-primary-fixed font-label-caps text-label-caps py-2.5 px-4 rounded transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,219,231,0.2)]"
        >
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1; font-size: 18px;">add</span>
          New Analysis
        </button>
      </div>

      <!-- Main Navigation -->
      <div class="flex-1 py-4 px-3 flex flex-col gap-1">
        @for (nav of navItems; track nav.id) {
          <button
            (click)="selectTab.emit(nav.id)"
            [class]="getNavClass(nav.id)"
          >
            <span class="material-symbols-outlined" style="font-size: 20px;">{{ nav.icon }}</span>
            <span class="font-body-sm text-body-sm font-medium">{{ nav.label }}</span>
          </button>
        }
      </div>

      <!-- Footer Nav -->
      <div class="p-3 border-t border-outline-variant/50 space-y-1">
        <div class="px-4 py-2 flex items-center justify-between text-data-mono font-data-mono text-[11px] text-on-surface-variant">
          <span>ENGINE STATUS</span>
          <span class="text-primary-fixed-dim font-bold flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim animate-ping inline-block"></span>
            ACTIVE
          </span>
        </div>
        <div class="px-4 py-1.5 flex items-center justify-between text-data-mono font-data-mono text-[11px] text-on-surface-variant">
          <span>FRAMEWORK</span>
          <span class="text-primary-fixed font-bold">Angular v22</span>
        </div>
      </div>
    </nav>
  `
})
export class SideNavBarComponent {
  @Input({ required: true }) currentTab!: NavigationTab;
  @Output() selectTab = new EventEmitter<NavigationTab>();
  @Output() openNewAnalysis = new EventEmitter<void>();

  navItems: { id: NavigationTab; label: string; icon: string }[] = [
    { id: 'exploration', label: 'Exploration', icon: 'query_stats' },
    { id: 'analysis',    label: 'Analysis',    icon: 'analytics'   },
    { id: 'archives',    label: 'Archives',    icon: 'inventory_2' },
    { id: 'database',    label: 'Database',    icon: 'storage'     },
    { id: 'protocols',   label: 'Protocols',   icon: 'terminal'    },
  ];

  getNavClass(id: NavigationTab): string {
    const base = 'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 transition-all duration-150 text-left cursor-pointer';
    if (this.currentTab === id) {
      return `${base} bg-secondary-container text-on-secondary-container border-primary-fixed-dim ring-1 ring-primary-fixed-dim/20 scale-[0.99]`;
    }
    return `${base} text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest border-transparent`;
  }
}
