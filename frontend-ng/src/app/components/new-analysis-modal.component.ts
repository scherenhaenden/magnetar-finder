import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-new-analysis-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 bg-[#080f10]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
         (click)="close.emit()">
      <div class="bg-[#192122] border border-[#00dbe7] rounded-lg max-w-lg w-full p-6 shadow-[0_0_25px_rgba(0,219,231,0.25)] flex flex-col gap-5 text-[#dce4e4]"
           (click)="$event.stopPropagation()">

        <div class="flex justify-between items-center border-b border-[#3a494b] pb-3">
          <h3 class="font-mono text-[18px] font-bold text-[#74f5ff] flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]">add</span>
            New Observation Analysis Pipeline
          </h3>
          <button (click)="close.emit()" class="text-[#b9cacb] hover:text-[#ffb4ab] cursor-pointer transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form (ngSubmit)="handleSubmit()" class="space-y-4 font-mono text-[12px]">
          <div>
            <label class="text-[#b9cacb] uppercase block mb-1 text-[10px] tracking-wider">Pipeline Title</label>
            <input type="text" [(ngModel)]="pipelineTitle" name="pipelineTitle"
              class="w-full bg-[#080f10] border border-[#3a494b] rounded p-2 text-[#dce4e4] focus:border-[#00dbe7] outline-none transition-colors" />
          </div>

          <div>
            <label class="text-[#b9cacb] uppercase block mb-1 text-[10px] tracking-wider">Primary Observatory Stream</label>
            <select [(ngModel)]="telescopeSource" name="telescopeSource"
              class="w-full bg-[#080f10] border border-[#3a494b] rounded p-2 text-[#00dbe7] focus:border-[#00dbe7] outline-none">
              <option>Swift / BAT Joint Feed</option>
              <option>Fermi Gamma-ray Burst Monitor</option>
              <option>Chandra High Resolution Camera</option>
              <option>RXTE Proportional Counter Array</option>
              <option>XMM-Newton EPIC Camera</option>
            </select>
          </div>

          <div>
            <label class="text-[#b9cacb] uppercase block mb-1 text-[10px] tracking-wider">Energy Band Filter (keV)</label>
            <input type="text" [(ngModel)]="energyBand" name="energyBand"
              class="w-full bg-[#080f10] border border-[#3a494b] rounded p-2 text-[#dce4e4] focus:border-[#00dbe7] outline-none transition-colors" />
          </div>

          <div class="flex justify-end gap-3 pt-3 border-t border-[#3a494b]">
            <button type="button" (click)="close.emit()"
              class="px-4 py-2 text-[#b9cacb] hover:text-[#dce4e4] font-bold uppercase tracking-wider cursor-pointer transition-colors">
              Cancel
            </button>
            <button type="submit"
              class="px-5 py-2 bg-[#00dbe7] text-[#002022] font-bold uppercase tracking-wider rounded hover:bg-[#74f5ff] transition-colors cursor-pointer">
              Launch Pipeline
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class NewAnalysisModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() launch = new EventEmitter<string>();

  pipelineTitle = 'SGR 1806-20 Spectral Flare Correlator';
  telescopeSource = 'Swift / BAT Joint Feed';
  energyBand = '0.5 - 100 keV';

  handleSubmit() {
    if (this.pipelineTitle.trim()) {
      this.launch.emit(this.pipelineTitle.trim());
      this.close.emit();
    }
  }
}
