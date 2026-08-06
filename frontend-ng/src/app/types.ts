export type NavigationTab = 'analysis' | 'exploration' | 'database' | 'archives' | 'protocols';

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  nodeType: 'signal' | 'burst' | 'highlight' | 'warning' | 'normal';
}

export interface UniqueGroup {
  id: string;
  value: string;
  label?: string;
  count: number;
  confidence?: string;
  peakDailyRate: string;
  distributionBars: number[];
  timelineEvents: TimelineEvent[];
}

export interface DatabaseSource {
  id: string;
  name: string;
  size: string;
  records: string;
  lastSync: string;
  status: 'active' | 'syncing' | 'error' | 'offline';
  connected: boolean;
}

export interface SavedFinding {
  id: string;
  eventId: string;
  type: string;
  magnitude: string;
  customNote: string;
  bookmarked: boolean;
}

export interface QueryResult {
  id: string;
  statusLight: 'active' | 'warning' | 'error';
  sourceDb: string;
  timestamp: string;
  previewContent: string;
  saved?: boolean;
  antecedents: {
    eventId: string;
    precursorEnergyErgs: string;
    orbitalPhase: string;
    telemetryStation: string;
    harmonicFrequenciesHz: number[];
    waveformPoints: number[];
  };
}

export interface ProtocolItem {
  id: string;
  name: string;
  category: string;
  description: string;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  lastRun: string;
  executionTimeMs: number;
}

export interface ArchiveFile {
  id: string;
  name: string;
  size: string;
  date: string;
  telescope: string;
  downloads: number;
}
