import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NavigationTab, QueryResult, DatabaseSource, SavedFinding, UniqueGroup } from './types';
import {
  INITIAL_UNIQUES_GROUPS, INITIAL_DATABASES, INITIAL_SAVED_FINDINGS,
  INITIAL_QUERY_RESULTS, INITIAL_PROTOCOLS, INITIAL_ARCHIVES
} from './data/mock-data';

import { SideNavBarComponent } from './components/side-nav-bar.component';
import { TopAppBarComponent } from './components/top-app-bar.component';
import { AnalysisViewComponent } from './components/analysis-view.component';
import { ExplorationViewComponent } from './components/exploration-view.component';
import { DatabaseViewComponent } from './components/database-view.component';
import { ArchivesViewComponent } from './components/archives-view.component';
import { ProtocolsViewComponent } from './components/protocols-view.component';
import { AntecedentsModalComponent } from './components/antecedents-modal.component';
import { ConnectSqliteModalComponent } from './components/connect-sqlite-modal.component';
import { NewAnalysisModalComponent } from './components/new-analysis-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SideNavBarComponent,
    TopAppBarComponent,
    AnalysisViewComponent,
    ExplorationViewComponent,
    DatabaseViewComponent,
    ArchivesViewComponent,
    ProtocolsViewComponent,
    AntecedentsModalComponent,
    ConnectSqliteModalComponent,
    NewAnalysisModalComponent,
  ],
  template: `
    <div class="min-h-screen bg-[#0d1515] text-[#dce4e4] flex overflow-hidden" style="font-family: 'Inter', sans-serif;">

      <!-- Side Navigation -->
      <app-side-nav-bar
        [currentTab]="currentTab()"
        (selectTab)="currentTab.set($event)"
        (openNewAnalysis)="showNewAnalysisModal.set(true)"
      ></app-side-nav-bar>

      <!-- Main Canvas -->
      <div class="flex-1 flex flex-col ml-[280px] min-w-0 overflow-hidden">

        <!-- Top Bar -->
        <app-top-app-bar
          [searchQuery]="globalSearchQuery()"
          (searchChange)="globalSearchQuery.set($event)"
          [activeSubTab]="activeSubTab()"
          (selectSubTab)="activeSubTab.set($event)"
          [isExecuting]="isExecutingQuery()"
          (executeQuery)="handleExecuteGlobalQuery()"
        ></app-top-app-bar>

        <!-- Main View -->
        <main class="flex-1 overflow-hidden">
          @if (currentTab() === 'analysis') {
            <app-analysis-view
              [uniquesGroups]="uniquesGroups()"
              [selectedGroup]="selectedGroup()"
              (selectGroup)="selectedGroup.set($event)"
              (saveNote)="handleSaveAnalyticalNote($event)"
            ></app-analysis-view>
          }
          @if (currentTab() === 'exploration') {
            <app-exploration-view
              [databases]="databases()"
              [queryResults]="queryResults()"
              (toggleDatabase)="handleToggleDatabase($event)"
              (selectAntecedents)="selectedAntecedent.set($event)"
              (saveResult)="handleSaveQueryResult($event)"
              (connectDatabase)="showConnectSqliteModal.set(true)"
            ></app-exploration-view>
          }
          @if (currentTab() === 'database') {
            <app-database-view
              [databases]="databases()"
              [savedFindings]="savedFindings()"
              (toggleBookmark)="handleToggleBookmark($event)"
              (connectSqlite)="showConnectSqliteModal.set(true)"
            ></app-database-view>
          }
          @if (currentTab() === 'archives') {
            <app-archives-view
              [archives]="archives"
            ></app-archives-view>
          }
          @if (currentTab() === 'protocols') {
            <app-protocols-view
              [protocols]="protocols"
            ></app-protocols-view>
          }
        </main>
      </div>

      <!-- Modals -->
      @if (selectedAntecedent()) {
        <app-antecedents-modal
          [result]="selectedAntecedent()!"
          (close)="selectedAntecedent.set(null)"
        ></app-antecedents-modal>
      }
      @if (showConnectSqliteModal()) {
        <app-connect-sqlite-modal
          (close)="showConnectSqliteModal.set(false)"
          (connect)="handleConnectDatabase($event)"
        ></app-connect-sqlite-modal>
      }
      @if (showNewAnalysisModal()) {
        <app-new-analysis-modal
          (close)="showNewAnalysisModal.set(false)"
          (launch)="handleLaunchNewAnalysis($event)"
        ></app-new-analysis-modal>
      }
    </div>
  `
})
export class AppComponent {
  // Navigation
  currentTab  = signal<NavigationTab>('analysis');
  activeSubTab = signal<string>('History');
  globalSearchQuery = signal<string>('');

  // Core Data
  databases    = signal<DatabaseSource[]>(INITIAL_DATABASES);
  savedFindings = signal<SavedFinding[]>(INITIAL_SAVED_FINDINGS);
  queryResults  = signal<QueryResult[]>(INITIAL_QUERY_RESULTS);
  uniquesGroups = signal<UniqueGroup[]>(INITIAL_UNIQUES_GROUPS);
  selectedGroup = signal<UniqueGroup>(INITIAL_UNIQUES_GROUPS[0]);

  archives  = INITIAL_ARCHIVES;
  protocols = INITIAL_PROTOCOLS;

  // Modals
  selectedAntecedent    = signal<QueryResult | null>(null);
  showConnectSqliteModal = signal<boolean>(false);
  showNewAnalysisModal   = signal<boolean>(false);
  isExecutingQuery       = signal<boolean>(false);

  handleToggleDatabase(id: string) {
    this.databases.update(prev =>
      prev.map(db => db.id === id ? { ...db, connected: !db.connected } : db)
    );
  }

  handleToggleBookmark(id: string) {
    this.savedFindings.update(prev =>
      prev.map(f => f.id === id ? { ...f, bookmarked: !f.bookmarked } : f)
    );
  }

  handleSaveQueryResult(result: QueryResult) {
    this.queryResults.update(prev =>
      prev.map(q => q.id === result.id ? { ...q, saved: true } : q)
    );
    if (!this.savedFindings().some(f => f.eventId === result.antecedents.eventId)) {
      const newFinding: SavedFinding = {
        id: 'find-' + Date.now(),
        eventId: result.antecedents.eventId,
        type: 'Gamma Flare',
        magnitude: result.antecedents.precursorEnergyErgs + ' erg',
        customNote: result.previewContent.substring(0, 100) + '...',
        bookmarked: true
      };
      this.savedFindings.update(prev => [newFinding, ...prev]);
    }
  }

  handleConnectDatabase(evt: { dbName: string; dbSize: string }) {
    const newDb: DatabaseSource = {
      id: 'db-' + Date.now(),
      name: evt.dbName,
      size: evt.dbSize,
      records: '1,120,400',
      lastSync: 'Just now',
      status: 'active',
      connected: true
    };
    this.databases.update(prev => [...prev, newDb]);
  }

  handleSaveAnalyticalNote(evt: { groupValue: string; noteText: string }) {
    this.uniquesGroups.update(prev =>
      prev.map(g => {
        if (g.value !== evt.groupValue) return g;
        return {
          ...g,
          timelineEvents: [
            {
              id: 'tle-' + Date.now(),
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              title: 'Researcher_Note_Added',
              description: evt.noteText.substring(0, 120),
              nodeType: 'highlight' as const
            },
            ...g.timelineEvents
          ]
        };
      })
    );
    // Also update selectedGroup if it's the same
    if (this.selectedGroup().value === evt.groupValue) {
      const updated = this.uniquesGroups().find(g => g.value === evt.groupValue);
      if (updated) this.selectedGroup.set(updated);
    }
  }

  handleExecuteGlobalQuery() {
    this.isExecutingQuery.set(true);
    setTimeout(() => {
      this.isExecutingQuery.set(false);
      const queryVal = this.globalSearchQuery();
      const newResult: QueryResult = {
        id: 'qr-' + Date.now(),
        statusLight: 'active',
        sourceDb: this.databases()[0]?.name || 'MGT_SGR_1806_20',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        previewContent: `Query "${queryVal || 'gamma burst spectrum'}" returned high-energy harmonics crossing detection threshold.`,
        saved: false,
        antecedents: {
          eventId: `EVT-${Math.floor(Math.random() * 800 + 100)}-Z`,
          precursorEnergyErgs: '9.2 × 10^45',
          orbitalPhase: '0.731 π rad',
          telemetryStation: 'Orbital Array Station 1',
          harmonicFrequenciesHz: [28.4, 56.8, 113.6],
          waveformPoints: [15, 30, 65, 120, 180, 220, 190, 130, 60, 25]
        }
      };
      this.queryResults.update(prev => [newResult, ...prev]);
      this.currentTab.set('exploration');
    }, 600);
  }

  handleLaunchNewAnalysis(title: string) {
    alert(`Launched observation pipeline: ${title}\nIngesting real-time satellite telemetry stream...`);
    this.currentTab.set('exploration');
  }
}
