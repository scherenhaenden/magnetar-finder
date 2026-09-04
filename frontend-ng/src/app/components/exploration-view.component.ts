import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseSource, QueryResult } from '../types';

@Component({
  selector: 'app-exploration-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="flex-1 md:mt-16 bg-surface flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden">

      <!-- Left Sidebar: Database Filters -->
      <aside class="w-full md:w-64 border-r border-outline-variant bg-surface-container-low flex flex-col overflow-y-auto shrink-0 hidden lg:flex">
        <div class="p-4 border-b border-outline-variant/50 sticky top-0 bg-surface-container-low/90 backdrop-blur z-10">
          <h2 class="font-label-caps text-label-caps text-on-surface mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined" style="font-size: 16px;">database</span>
            ACTIVE DATABASES
          </h2>
          <div class="relative">
            <span class="material-symbols-outlined absolute left-2 top-2 text-on-surface-variant" style="font-size: 16px;">search</span>
            <input
              type="text"
              [(ngModel)]="dbFilter"
              placeholder="Filter sources..."
              class="w-full bg-surface-container-lowest border border-outline-variant rounded font-data-mono text-data-mono text-on-surface py-1.5 pl-8 pr-2 focus:ring-1 focus:ring-primary-fixed-dim focus:border-primary-fixed-dim placeholder-on-surface-variant/50 transition-all inner-glow"
            />
          </div>
        </div>

        <div class="p-2 flex flex-col gap-1 flex-1">
          @for (db of filteredDatabases; track db.id) {
            <label
              (click)="toggleDatabase.emit(db.id)"
              class="flex items-center gap-3 p-2 rounded hover:bg-surface-container-highest cursor-pointer group transition-colors"
            >
              <div class="relative flex items-center">
                <input [checked]="db.connected" type="checkbox" class="peer sr-only"/>
                <div class="w-4 h-4 rounded-sm border border-outline-variant bg-surface-container-lowest peer-checked:bg-primary-fixed-dim peer-checked:border-primary-fixed-dim flex items-center justify-center transition-all">
                  <span class="material-symbols-outlined text-on-primary-fixed opacity-0 peer-checked:opacity-100 transition-opacity" style="font-size: 12px; font-weight: bold;">check</span>
                </div>
              </div>
              <div class="flex-1 overflow-hidden">
                <div class="font-data-mono text-data-mono text-on-surface truncate group-hover:text-primary-fixed transition-colors">
                  {{ db.name }}
                </div>
                <div class="text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-wider">
                  SQLite • {{ db.size }}
                </div>
              </div>
            </label>
          }
        </div>

        <div class="mt-auto p-4 border-t border-outline-variant/50">
          <button
            (click)="connectDatabase.emit()"
            class="w-full bg-transparent border border-outline-variant hover:border-primary-fixed hover:text-primary-fixed text-on-surface-variant font-label-caps text-label-caps py-2 rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span class="material-symbols-outlined" style="font-size: 16px;">add_link</span>
            Connect Database
          </button>
        </div>
      </aside>

      <!-- Right Content Area -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Search & Filter Panel -->
        <div class="p-6 border-b border-outline-variant bg-surface shrink-0">
          <div class="bg-surface-container border border-outline-variant rounded-lg p-1 flex flex-col focus-within:border-primary-fixed-dim/50 focus-within:ring-1 focus-within:ring-primary-fixed-dim/20 transition-all">
            <!-- Search Chips -->
            <div class="flex flex-wrap gap-2 p-2">
              <div class="flex items-center bg-surface-container-highest border border-outline-variant rounded px-2 py-1 gap-2 group">
                <span class="font-label-caps text-[9px] text-on-surface-variant uppercase">Operator</span>
                <span class="font-data-mono text-[11px] text-primary-fixed">CONTAINS</span>
                <span class="text-on-surface font-body-sm text-[13px] border-l border-outline-variant pl-2 ml-1">"gamma ray burst"</span>
                <button class="ml-1 text-on-surface-variant hover:text-error transition-colors cursor-pointer">
                  <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
                </button>
              </div>

              <div class="flex items-center bg-surface-container-highest border border-outline-variant rounded px-2 py-1 gap-2 group">
                <span class="font-label-caps text-[9px] text-on-surface-variant uppercase">Operator</span>
                <span class="font-data-mono text-[11px] text-error">NOT CONTAINS</span>
                <span class="text-on-surface font-body-sm text-[13px] border-l border-outline-variant pl-2 ml-1">"solar flare"</span>
                <button class="ml-1 text-on-surface-variant hover:text-error transition-colors cursor-pointer">
                  <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
                </button>
              </div>

              <input
                type="text"
                [(ngModel)]="queryInput"
                (keyup.enter)="handleAddChip()"
                placeholder="Add query parameters..."
                class="flex-1 min-w-[200px] bg-transparent border-none text-on-surface font-body-sm focus:ring-0 focus:outline-none placeholder-on-surface-variant/50 p-1"
              />
            </div>

            <!-- Filter Bar -->
            <div class="flex flex-wrap items-center justify-between border-t border-outline-variant/50 p-2 gap-4">
              <div class="flex items-center gap-3">
                <button class="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant hover:border-primary-fixed-dim/50 rounded px-3 py-1.5 transition-colors cursor-pointer">
                  <span class="material-symbols-outlined text-on-surface-variant" style="font-size: 16px;">calendar_month</span>
                  <span class="font-data-mono text-data-mono text-on-surface">2023.01.01 - 2023.12.31</span>
                </button>

                <div class="flex rounded bg-surface-container-lowest border border-outline-variant overflow-hidden">
                  <button
                    (click)="logicMode = 'AND'"
                    [class]="logicMode === 'AND' ? 'bg-primary-fixed/10 text-primary-fixed font-bold' : 'text-on-surface-variant hover:bg-surface-container-highest'"
                    class="px-3 py-1.5 font-label-caps text-label-caps border-r border-outline-variant transition-colors cursor-pointer"
                  >
                    AND
                  </button>
                  <button
                    (click)="logicMode = 'OR'"
                    [class]="logicMode === 'OR' ? 'bg-primary-fixed/10 text-primary-fixed font-bold' : 'text-on-surface-variant hover:bg-surface-container-highest'"
                    class="px-3 py-1.5 font-label-caps text-label-caps transition-colors cursor-pointer"
                  >
                    OR
                  </button>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button class="text-on-surface-variant hover:text-on-surface font-label-caps text-[10px] uppercase tracking-wider px-2 py-1 cursor-pointer">
                  Clear Filters
                </button>
                <button class="bg-primary-fixed-dim hover:bg-primary-fixed text-on-primary-fixed font-label-caps text-label-caps py-1.5 px-4 rounded transition-colors flex items-center gap-2 shadow-[0_0_10px_rgba(0,219,231,0.2)] cursor-pointer">
                  <span class="material-symbols-outlined" style="font-size: 16px;">search</span>
                  SEARCH
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Data Table Section -->
        <div class="flex-1 bg-surface-container-lowest relative overflow-hidden flex flex-col">
          <!-- Table Header -->
          <div class="grid grid-cols-12 gap-4 px-6 py-3 border-b border-outline-variant bg-surface-dim/90 backdrop-blur z-20 font-label-caps text-label-caps text-on-surface-variant sticky top-0">
            <div class="col-span-1 flex items-center gap-1 cursor-pointer hover:text-primary-fixed transition-colors">
              STATUS <span class="material-symbols-outlined" style="font-size: 14px;">arrow_drop_down</span>
            </div>
            <div class="col-span-2 flex items-center gap-1 cursor-pointer hover:text-primary-fixed transition-colors">
              SOURCE DB
            </div>
            <div class="col-span-2 flex items-center gap-1 cursor-pointer hover:text-primary-fixed transition-colors">
              TIMESTAMP (UTC)
            </div>
            <div class="col-span-4">CONTENT PREVIEW</div>
            <div class="col-span-3 text-right">ACTIONS</div>
          </div>

          <!-- Table Body -->
          <div class="flex-1 overflow-y-auto data-scroll pb-20">
            @for (res of queryResults; track res.id) {
              <div class="grid grid-cols-12 gap-4 px-6 py-3 border-b border-outline-variant/30 table-row-hover items-center transition-colors group">
                <div class="col-span-1 flex items-center">
                  <div [class]="res.statusLight === 'active' ? 'bg-primary-fixed shadow-[0_0_8px_rgba(116,245,255,0.8)]' : res.statusLight === 'warning' ? 'bg-tertiary-fixed' : 'bg-surface-variant'" class="w-2 h-2 rounded-full"></div>
                </div>
                <div class="col-span-2 font-data-mono text-[12px] text-on-surface truncate">
                  {{ res.sourceDb }}
                </div>
                <div class="col-span-2 font-data-mono text-[12px] text-on-surface-variant">
                  {{ res.timestamp }}
                </div>
                <div class="col-span-4 font-body-sm text-body-sm text-on-surface truncate pr-4 text-opacity-90">
                  {{ res.previewContent }}
                </div>
                <div class="col-span-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    (click)="selectAntecedents.emit(res)"
                    class="px-3 py-1 font-label-caps text-[10px] text-on-surface-variant hover:text-on-surface border border-transparent hover:border-outline-variant rounded transition-colors cursor-pointer"
                  >
                    VIEW ANTECEDENTS
                  </button>
                  <button
                    (click)="!res.saved && saveResult.emit(res)"
                    [disabled]="res.saved"
                    [class]="res.saved ? 'text-on-primary-fixed bg-primary-fixed-dim' : 'text-primary-fixed border-primary-fixed-dim/50 hover:bg-primary-fixed/10'"
                    class="px-3 py-1 font-label-caps text-[10px] border rounded transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-default"
                  >
                    <span class="material-symbols-outlined" style="font-size: 12px;">{{ res.saved ? 'check' : 'bookmark_add' }}</span>
                    {{ res.saved ? 'SAVED' : 'SAVE' }}
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Footer Status Bar -->
          <div class="absolute bottom-0 left-0 right-0 h-10 border-t border-outline-variant bg-surface-container flex items-center justify-between px-6 font-data-mono text-[11px] text-on-surface-variant z-20">
            <div>Showing 1 - {{ queryResults.length }} of 1,402 results</div>
            <div class="flex items-center gap-4">
              <span class="flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-primary-fixed inline-block"></span>
                Query Execution: 42ms
              </span>
              <span>Server: Node Alpha</span>
            </div>
          </div>
        </div>
      </div>

    </main>
  `
})
export class ExplorationViewComponent {
  @Input({ required: true }) databases!: DatabaseSource[];
  @Input({ required: true }) queryResults!: QueryResult[];

  @Output() toggleDatabase = new EventEmitter<string>();
  @Output() selectAntecedents = new EventEmitter<QueryResult>();
  @Output() saveResult = new EventEmitter<QueryResult>();
  @Output() connectDatabase = new EventEmitter<void>();

  dbFilter = '';
  queryInput = '';
  logicMode: 'AND' | 'OR' = 'AND';

  get filteredDatabases(): DatabaseSource[] {
    if (!this.dbFilter.trim()) return this.databases;
    return this.databases.filter(d => d.name.toLowerCase().includes(this.dbFilter.toLowerCase()));
  }

  handleAddChip() {
    this.queryInput = '';
  }
}
