import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArchiveFile } from '../types';

@Component({
  selector: 'app-archives-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex-1 mt-16 p-8 h-[calc(100vh-64px)] overflow-y-auto bg-[#0d1515] text-[#dce4e4]">
      <div class="max-w-6xl mx-auto space-y-6">

        <!-- Header -->
        <div class="border-b border-[#3a494b] pb-4 flex items-center justify-between">
          <div>
            <h2 class="font-['Inter',sans-serif] text-[24px] font-semibold text-[#dce4e4]">FITS Archives</h2>
            <p class="text-[14px] text-[#b9cacb] mt-1">Scientific data files from telescope observation campaigns.</p>
          </div>
          <!-- Search filter -->
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#b9cacb] text-[16px]">search</span>
            <input
              type="text"
              [(ngModel)]="filter"
              placeholder="Filter archives..."
              class="bg-[#151d1e] border border-[#3a494b] rounded py-1.5 pl-9 pr-3 font-mono text-[12px] text-[#dce4e4] placeholder-[#b9cacb]/50 focus:border-[#00dbe7] focus:outline-none w-56"
            />
          </div>
        </div>

        <!-- Archive Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (archive of filteredArchives; track archive.id) {
            <div class="bg-[#192122] border border-[#3a494b] rounded-lg p-5 hover:border-[#00dbe7]/50 transition-colors flex flex-col justify-between">
              <div>
                <div class="flex items-center gap-2 text-[#00dbe7] font-mono text-[12px] font-bold mb-3">
                  <span class="material-symbols-outlined text-[18px]">folder_zip</span>
                  {{ archive.size }}
                </div>
                <h3 class="font-semibold text-[13px] text-[#dce4e4] mb-3 break-all leading-snug">{{ archive.name }}</h3>
                <div class="text-[12px] text-[#b9cacb] space-y-1.5 font-mono">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[14px] text-[#3a494b]">telescope</span>
                    {{ archive.telescope }}
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[14px] text-[#3a494b]">calendar_today</span>
                    {{ archive.date }}
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[14px] text-[#3a494b]">download</span>
                    {{ archive.downloads | number }} downloads
                  </div>
                </div>
              </div>

              <button
                (click)="downloadArchive(archive.name)"
                class="mt-5 w-full py-2 bg-[#2e3637] hover:bg-[#00dbe7] hover:text-[#002022] text-[#dce4e4] font-bold text-[11px] uppercase tracking-wider rounded border border-[#3a494b] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]">download</span>
                Download Archive
              </button>
            </div>
          }
        </div>

      </div>
    </div>
  `
})
export class ArchivesViewComponent {
  @Input({ required: true }) archives!: ArchiveFile[];

  filter = '';

  get filteredArchives(): ArchiveFile[] {
    if (!this.filter.trim()) return this.archives;
    const q = this.filter.toLowerCase();
    return this.archives.filter(a =>
      a.name.toLowerCase().includes(q) || a.telescope.toLowerCase().includes(q)
    );
  }

  downloadArchive(name: string) {
    alert(`Initiating download: ${name}`);
  }
}
