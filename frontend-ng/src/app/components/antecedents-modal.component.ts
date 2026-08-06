import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryResult } from '../types';

@Component({
  selector: 'app-antecedents-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 bg-[#080f10]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
         (click)="close.emit()">
      <div class="bg-[#192122] border border-[#00dbe7] rounded-lg max-w-lg w-full p-6 shadow-[0_0_30px_rgba(0,219,231,0.2)] flex flex-col gap-5 text-[#dce4e4]"
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex justify-between items-center border-b border-[#3a494b] pb-3">
          <h3 class="font-mono text-[18px] font-bold text-[#74f5ff] flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]">radar</span>
            Antecedent Data — {{ result.antecedents.eventId }}
          </h3>
          <button (click)="close.emit()" class="text-[#b9cacb] hover:text-[#ffb4ab] cursor-pointer transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Data Grid -->
        <div class="font-mono text-[12px] space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-[#0d1515] border border-[#3a494b] rounded p-3">
              <div class="text-[#b9cacb] text-[10px] uppercase tracking-wider mb-1">Precursor Energy</div>
              <div class="text-[#74f5ff] font-bold">{{ result.antecedents.precursorEnergyErgs }} erg</div>
            </div>
            <div class="bg-[#0d1515] border border-[#3a494b] rounded p-3">
              <div class="text-[#b9cacb] text-[10px] uppercase tracking-wider mb-1">Orbital Phase</div>
              <div class="text-[#74f5ff] font-bold">{{ result.antecedents.orbitalPhase }}</div>
            </div>
          </div>

          <div class="bg-[#0d1515] border border-[#3a494b] rounded p-3">
            <div class="text-[#b9cacb] text-[10px] uppercase tracking-wider mb-1">Telemetry Station</div>
            <div class="text-[#dce4e4]">{{ result.antecedents.telemetryStation }}</div>
          </div>

          <div class="bg-[#0d1515] border border-[#3a494b] rounded p-3">
            <div class="text-[#b9cacb] text-[10px] uppercase tracking-wider mb-2">Harmonic Frequencies</div>
            <div class="flex gap-2 flex-wrap">
              @for (freq of result.antecedents.harmonicFrequenciesHz; track freq) {
                <span class="px-2 py-0.5 bg-[#00dbe7]/20 border border-[#00dbe7]/50 text-[#00dbe7] rounded font-bold">
                  {{ freq }} Hz
                </span>
              }
            </div>
          </div>

          <!-- Mini Waveform -->
          <div class="bg-[#0d1515] border border-[#3a494b] rounded p-3">
            <div class="text-[#b9cacb] text-[10px] uppercase tracking-wider mb-2">Waveform Profile</div>
            <div class="flex items-end gap-0.5 h-12">
              @for (pt of result.antecedents.waveformPoints; track $index) {
                <div
                  class="flex-1 bg-[#00dbe7]/30 hover:bg-[#00dbe7]/60 transition-colors rounded-t"
                  [style.height.%]="(pt / maxWaveform) * 100"
                ></div>
              }
            </div>
          </div>
        </div>

        <!-- Source -->
        <div class="border-t border-[#3a494b] pt-3 font-mono text-[11px] text-[#b9cacb]">
          Source: <span class="text-[#74f5ff]">{{ result.sourceDb }}</span>
          &nbsp;·&nbsp;
          Captured: <span class="text-[#dce4e4]">{{ result.timestamp }}</span>
        </div>
      </div>
    </div>
  `
})
export class AntecedentsModalComponent {
  @Input({ required: true }) result!: QueryResult;
  @Output() close = new EventEmitter<void>();

  get maxWaveform(): number {
    return Math.max(...(this.result?.antecedents.waveformPoints ?? [1]));
  }
}
