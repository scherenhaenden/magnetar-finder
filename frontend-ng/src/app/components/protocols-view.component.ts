import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProtocolItem } from '../types';

@Component({
  selector: 'app-protocols-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex-1 mt-16 p-8 h-[calc(100vh-64px)] overflow-y-auto bg-[#0d1515] text-[#dce4e4]">
      <div class="max-w-6xl mx-auto space-y-6">

        <!-- Header -->
        <div class="border-b border-[#3a494b] pb-4">
          <h2 class="font-['Inter',sans-serif] text-[24px] font-semibold text-[#dce4e4]">Automated Pipeline Protocols</h2>
          <p class="text-[14px] text-[#b9cacb] mt-1">FFT harmonic decomposition, pulsar timing monitors, and plasma simulations.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <!-- Protocol Cards -->
          <div class="space-y-4">
            @for (p of activeProtocols; track p.id) {
              <div class="bg-[#192122] border border-[#3a494b] rounded-lg p-5 hover:border-[#00dbe7]/30 transition-colors flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-[#00dbe7] font-mono">{{ p.category }}</span>
                    <span [class]="getStatusClass(p.status)" class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                      {{ p.status }}
                    </span>
                  </div>
                  <h3 class="font-mono text-[15px] font-bold text-[#dce4e4] mb-2">{{ p.name }}</h3>
                  <p class="text-[12px] text-[#b9cacb] leading-relaxed">{{ p.description }}</p>
                </div>

                <div class="flex items-center justify-between border-t border-[#3a494b] pt-3 mt-4">
                  <div class="font-mono text-[11px] text-[#b9cacb]">
                    <span>Last Run: {{ p.lastRun }}</span>
                    &nbsp;·&nbsp;
                    <span>{{ p.executionTimeMs }}ms</span>
                  </div>
                  <button
                    (click)="runProtocol(p.id, p.name)"
                    [disabled]="runningId === p.id"
                    class="px-4 py-1.5 bg-[#00dbe7] text-[#002022] font-bold text-[11px] uppercase tracking-wider rounded hover:bg-[#74f5ff] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span class="material-symbols-outlined text-[16px]">
                      {{ runningId === p.id ? 'sync' : 'play_arrow' }}
                    </span>
                    {{ runningId === p.id ? 'Running...' : 'Run Protocol' }}
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Live CLI Console -->
          <div class="bg-[#080f10] border border-[#3a494b] rounded-lg p-4 flex flex-col h-[540px]">
            <div class="flex items-center justify-between border-b border-[#3a494b] pb-3 mb-3 shrink-0">
              <div class="flex items-center gap-2 text-[12px] font-mono font-bold text-[#00dbe7]">
                <span class="material-symbols-outlined text-[16px]">terminal</span>
                TELEMETRY_CLI_OUTPUT
              </div>
              <button
                (click)="consoleLogs = []"
                class="text-[10px] font-mono text-[#b9cacb] hover:text-[#dce4e4] uppercase cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div class="flex-1 overflow-y-auto font-mono text-[12px] text-[#74f5ff] space-y-1.5 p-2 bg-[#0d1515] rounded border border-[#3a494b]/50" #consoleEl>
              @for (log of consoleLogs; track $index) {
                <div class="leading-relaxed">
                  <span class="text-[#3a494b] select-none">&gt; </span>
                  <span [class]="getLogColor(log)">{{ log }}</span>
                </div>
              }
              @if (consoleLogs.length === 0) {
                <div class="text-[#3a494b] italic">Console cleared.</div>
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class ProtocolsViewComponent implements OnInit {
  @Input({ required: true }) protocols!: ProtocolItem[];

  activeProtocols: ProtocolItem[] = [];
  consoleLogs: string[] = [
    '[SYSTEM] Magnetar Finder Automation Engine v4.2 initialized.',
    '[FFT] QPO Peak detected at 24.5 Hz in sector 4 lightcurve.',
    '[SYNC] Cross-satellite time-of-arrival delay: +1.284 ms.',
    '[READY] All execution protocols armed.'
  ];
  runningId: string | null = null;

  ngOnInit() {
    this.activeProtocols = [...this.protocols];
  }

  runProtocol(id: string, name: string) {
    this.runningId = id;
    this.consoleLogs.push(`[TRIGGER] Initiating ${name}...`);

    setTimeout(() => {
      this.activeProtocols = this.activeProtocols.map(p =>
        p.id === id ? { ...p, status: 'RUNNING', lastRun: 'Running...' } : p
      );
      this.consoleLogs.push(`[EXEC] ${name}: Computing FFT across 1,402,883 telemetry records...`);
    }, 400);

    setTimeout(() => {
      this.activeProtocols = this.activeProtocols.map(p =>
        p.id === id ? { ...p, status: 'COMPLETED', lastRun: 'Just now' } : p
      );
      this.consoleLogs.push(`[SUCCESS] ${name} completed in ${this.activeProtocols.find(p => p.id === id)?.executionTimeMs ?? 420}ms. Results cached.`);
      this.runningId = null;
    }, 1400);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'RUNNING':   return 'bg-[#00dbe7]/20 text-[#74f5ff] animate-pulse';
      case 'COMPLETED': return 'bg-[#3a4a5f] text-[#a9bad3]';
      case 'ERROR':     return 'bg-[#ffb4ab]/20 text-[#ffb4ab]';
      default:          return 'bg-[#333b3b] text-[#b9cacb]';
    }
  }

  getLogColor(log: string): string {
    if (log.includes('[SUCCESS]')) return 'text-[#00dbe7]';
    if (log.includes('[EXEC]'))    return 'text-[#74f5ff]';
    if (log.includes('[TRIGGER]')) return 'text-[#ffb347]';
    if (log.includes('[READY]'))   return 'text-[#a9bad3]';
    return 'text-[#74f5ff]';
  }
}
