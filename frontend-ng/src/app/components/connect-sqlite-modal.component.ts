import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-connect-sqlite-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 bg-[#080f10]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
         (click)="close.emit()">
      <div class="bg-[#192122] border border-[#00dbe7] rounded-lg max-w-md w-full p-6 shadow-[0_0_25px_rgba(0,219,231,0.25)] flex flex-col gap-5 text-[#dce4e4]"
           (click)="$event.stopPropagation()">

        <div class="flex justify-between items-center border-b border-[#3a494b] pb-3">
          <h3 class="font-mono text-[18px] font-bold text-[#74f5ff] flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]">add_link</span>
            Connect SQLite Database
          </h3>
          <button (click)="close.emit()" class="text-[#b9cacb] hover:text-[#ffb4ab] cursor-pointer transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form (ngSubmit)="handleSubmit()" class="space-y-4 font-mono text-[12px]">
          <div>
            <label class="text-[#b9cacb] uppercase block mb-1 text-[10px] tracking-wider">Database Label / Name</label>
            <input type="text" [(ngModel)]="dbName" name="dbName"
              class="w-full bg-[#080f10] border border-[#3a494b] rounded p-2 text-[#dce4e4] focus:border-[#00dbe7] outline-none transition-colors" />
          </div>

          <div>
            <label class="text-[#b9cacb] uppercase block mb-1 text-[10px] tracking-wider">File Path or SQLite Attachment URI</label>
            <input type="text" [(ngModel)]="dbPath" name="dbPath"
              class="w-full bg-[#080f10] border border-[#3a494b] rounded p-2 text-[#dce4e4] focus:border-[#00dbe7] outline-none transition-colors" />
          </div>

          <!-- Drop Zone -->
          <div class="border border-dashed border-[#3a494b] rounded p-6 text-center text-[#b9cacb] hover:border-[#00dbe7] cursor-pointer transition-colors bg-[#080f10]">
            <span class="material-symbols-outlined text-[32px] text-[#00dbe7] block mb-2">upload_file</span>
            <div class="text-[12px]">Drop .sqlite, .db, or .fits file here</div>
            <div class="text-[10px] text-[#b9cacb]/60 mt-1">Supports SQLite v3 &amp; Virtual Tables</div>
          </div>

          <div class="flex justify-end gap-3 pt-3 border-t border-[#3a494b]">
            <button type="button" (click)="close.emit()"
              class="px-4 py-2 text-[#b9cacb] hover:text-[#dce4e4] font-bold uppercase tracking-wider cursor-pointer transition-colors">
              Cancel
            </button>
            <button type="submit"
              class="px-5 py-2 bg-[#00dbe7] text-[#002022] font-bold uppercase tracking-wider rounded hover:bg-[#74f5ff] transition-colors cursor-pointer">
              Connect Database
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class ConnectSqliteModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() connect = new EventEmitter<{ dbName: string; dbSize: string }>();

  dbName = 'SGR_0526_66.sqlite';
  dbPath = '/mnt/data/SGR_0526_66.sqlite';

  handleSubmit() {
    if (this.dbName.trim()) {
      this.connect.emit({ dbName: this.dbName.trim(), dbSize: '3.1 GB' });
      this.close.emit();
    }
  }
}
