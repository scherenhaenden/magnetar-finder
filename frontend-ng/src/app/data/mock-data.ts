import {
  UniqueGroup, DatabaseSource, SavedFinding,
  QueryResult, ProtocolItem, ArchiveFile
} from '../types';

export const INITIAL_UNIQUES_GROUPS: UniqueGroup[] = [
  {
    id: 'uniq-1',
    value: 'SGR_1806-20',
    label: 'Soft Gamma Repeater — Giant Flare Class',
    count: 142883,
    confidence: '99.7%',
    peakDailyRate: '12,400/day',
    distributionBars: [10, 20, 35, 70, 90, 120, 145, 130, 95, 60, 30, 15],
    timelineEvents: [
      {
        id: 'tle-1', time: '14:32',
        title: 'Giant_Flare_Peak_Detected',
        description: 'X-ray luminosity exceeded 2×10^47 erg/s. Spectral hardening confirmed across all orbital array stations.',
        nodeType: 'highlight'
      },
      {
        id: 'tle-2', time: '11:45',
        title: 'Magnetic_Flux_Warning',
        description: 'Automated system triggered anomalous pattern recognition protocol.',
        nodeType: 'warning'
      },
      {
        id: 'tle-3', time: '08:12',
        title: 'Routine_Telemetry_Sync',
        description: 'Standard handshake completed. No anomalies prior to 11:45 event horizon.',
        nodeType: 'normal'
      }
    ]
  },
  {
    id: 'uniq-2',
    value: 'AXP_1E_1048',
    label: 'Anomalous X-ray Pulsar — Multi-Epoch Timing',
    count: 38552,
    confidence: '97.2%',
    peakDailyRate: '1,980/day',
    distributionBars: [20, 25, 30, 45, 50, 75, 80, 65, 40, 30, 20, 15],
    timelineEvents: [
      {
        id: 'tle-201', time: '18:22',
        title: 'Spectrum_Refinement_Complete',
        description: 'Calibrated baseline noise using Swift Observatory archival tables.',
        nodeType: 'normal'
      },
      {
        id: 'tle-202', time: '15:10',
        title: 'High_Energy_Cluster',
        description: 'Synchronized telemetry across 3 orbiting satellite nodes.',
        nodeType: 'highlight'
      }
    ]
  },
  {
    id: 'uniq-3',
    value: 'XTE_J1810-197',
    label: 'Transient Magnetar — Radio Emission Source',
    count: 15901,
    confidence: '94.8%',
    peakDailyRate: '890/day',
    distributionBars: [5, 10, 20, 25, 40, 50, 60, 55, 35, 20, 10, 5],
    timelineEvents: [
      {
        id: 'tle-301', time: '09:30',
        title: 'XRay_Pulsation_Lock',
        description: 'Phase correlation reached 99.4% confidence index.',
        nodeType: 'highlight'
      }
    ]
  },
  {
    id: 'uniq-4',
    value: 'SGR_0526-66',
    label: 'Soft Gamma Repeater — LMC Association',
    count: 9440,
    confidence: '91.3%',
    peakDailyRate: '510/day',
    distributionBars: [15, 18, 22, 28, 35, 42, 48, 50, 38, 25, 18, 12],
    timelineEvents: [
      {
        id: 'tle-401', time: '04:15',
        title: 'Glitch_Precursor_Alert',
        description: 'Rotational frequency derivative shift detected.',
        nodeType: 'warning'
      }
    ]
  },
  {
    id: 'uniq-5',
    value: 'CXOU_J164710',
    label: 'Compact X-ray Source — Westerlund Cluster',
    count: 8211,
    confidence: '88.0%',
    peakDailyRate: '440/day',
    distributionBars: [8, 12, 16, 22, 30, 40, 60, 70, 50, 30, 15, 10],
    timelineEvents: []
  },
  {
    id: 'uniq-6',
    value: 'SGR_1935+2154',
    label: 'Soft Gamma Repeater — Fast Radio Burst Association',
    count: 4105,
    confidence: '85.5%',
    peakDailyRate: '210/day',
    distributionBars: [2, 5, 8, 14, 22, 35, 45, 55, 40, 20, 10, 4],
    timelineEvents: []
  }
];

export const INITIAL_DATABASES: DatabaseSource[] = [
  {
    id: 'db-1', name: 'MGT_SGR_1806_20',
    size: '14.8 GB', records: '1,402,883',
    lastSync: '2m ago', status: 'active', connected: true
  },
  {
    id: 'db-2', name: 'AXP_TIMING_ARCHIVE',
    size: '3.2 GB', records: '384,200',
    lastSync: '15m ago', status: 'active', connected: true
  },
  {
    id: 'db-3', name: 'FERMI_GBM_CATALOG',
    size: '8.5 GB', records: '890,441',
    lastSync: '1h ago', status: 'syncing', connected: false
  },
  {
    id: 'db-4', name: 'SWIFT_BAT_EVENTS',
    size: '22.1 GB', records: '2,100,000',
    lastSync: '3h ago', status: 'offline', connected: false
  }
];

export const INITIAL_SAVED_FINDINGS: SavedFinding[] = [
  {
    id: 'find-1', eventId: 'EVT-441-Z',
    type: 'Gamma Flare', magnitude: '8.7 × 10^44 erg',
    customNote: 'Confirmed QPO at 18 Hz during peak emission phase. Cross-referenced with RHESSI data.',
    bookmarked: true
  },
  {
    id: 'find-2', eventId: 'EVT-228-A',
    type: 'Spin Glitch', magnitude: '4.1 × 10^43 erg',
    customNote: 'Angular velocity jump Δν/ν = 10^-6. Classic crustal fracture signature.',
    bookmarked: false
  }
];

export const INITIAL_QUERY_RESULTS: QueryResult[] = [
  {
    id: 'qr-1', statusLight: 'active',
    sourceDb: 'MGT_SGR_1806_20',
    timestamp: '2024-12-04 14:32:01',
    previewContent: 'Giant flare spectral decomposition: peak luminosity 2×10^47 erg/s. Harmonic structure identified across 18–54 Hz band.',
    saved: false,
    antecedents: {
      eventId: 'EVT-441-Z', precursorEnergyErgs: '8.7 × 10^44',
      orbitalPhase: '0.441 π rad', telemetryStation: 'Orbital Array Station 4',
      harmonicFrequenciesHz: [18.0, 36.0, 54.0],
      waveformPoints: [10, 25, 60, 110, 175, 220, 195, 140, 70, 30]
    }
  },
  {
    id: 'qr-2', statusLight: 'warning',
    sourceDb: 'AXP_TIMING_ARCHIVE',
    timestamp: '2024-12-04 11:45:17',
    previewContent: 'Pulse arrival time residuals show glitch candidate. ΔP/P = 2.3×10^-6 over 4.2-second integration window.',
    saved: false,
    antecedents: {
      eventId: 'EVT-228-A', precursorEnergyErgs: '4.1 × 10^43',
      orbitalPhase: '0.228 π rad', telemetryStation: 'Ground Station RXTE-2',
      harmonicFrequenciesHz: [24.5, 49.0],
      waveformPoints: [5, 12, 28, 55, 90, 120, 100, 65, 32, 14]
    }
  },
  {
    id: 'qr-3', statusLight: 'active',
    sourceDb: 'MGT_SGR_1806_20',
    timestamp: '2024-12-04 08:12:44',
    previewContent: 'Routine telemetry sync complete. No transient burst activity detected in 6-hour observation window.',
    saved: true,
    antecedents: {
      eventId: 'EVT-081-C', precursorEnergyErgs: '1.2 × 10^42',
      orbitalPhase: '0.812 π rad', telemetryStation: 'Orbital Array Station 1',
      harmonicFrequenciesHz: [28.4, 56.8],
      waveformPoints: [2, 5, 10, 18, 25, 22, 15, 9, 4, 1]
    }
  }
];

export const INITIAL_PROTOCOLS: ProtocolItem[] = [
  {
    id: 'prot-1', name: 'FFT_Harmonic_Decomposition',
    category: 'Spectral Analysis',
    description: 'Decomposes high-frequency X-ray light curves into Fourier modes to detect magnetospheric quasi-periodic oscillations (QPOs).',
    status: 'COMPLETED', lastRun: '12m ago', executionTimeMs: 420
  },
  {
    id: 'prot-2', name: 'Glitch_Detection_Derivative',
    category: 'Pulsar Timing',
    description: 'Monitors pulse arrival times (TOAs) for sudden step changes in angular velocity corresponding to crustal fractures.',
    status: 'IDLE', lastRun: '2h ago', executionTimeMs: 185
  },
  {
    id: 'prot-3', name: 'Cross_Satellite_Correlator',
    category: 'Telemetry Sync',
    description: 'Cross-correlates time-of-arrival delays between Swift, Fermi, and Chandra to pin-point spatial source coordinates.',
    status: 'RUNNING', lastRun: 'Just now', executionTimeMs: 890
  },
  {
    id: 'prot-4', name: 'Relativistic_Plasma_Simulator',
    category: 'Theoretical Modeling',
    description: 'Simulates magnetic field line reconnection in twisted magnetospheres at 10^15 Gauss.',
    status: 'IDLE', lastRun: '1d ago', executionTimeMs: 14200
  }
];

export const INITIAL_ARCHIVES: ArchiveFile[] = [
  {
    id: 'arc-1',
    name: 'SGR_1806_20_2004_Giant_Flare_Full_Telemetry.fits',
    size: '14.8 GB', date: '2023-11-15',
    telescope: 'RXTE / RHESSI Joint', downloads: 1420
  },
  {
    id: 'arc-2',
    name: 'AXP_1E_1048_Multi_Epoch_Timing_Logs.csv',
    size: '3.2 GB', date: '2023-10-02',
    telescope: 'XMM-Newton Observatory', downloads: 890
  },
  {
    id: 'arc-3',
    name: 'MagStar_Spectral_Energy_Distributions_V4.json',
    size: '850 MB', date: '2023-08-20',
    telescope: 'Chandra High-Resolution Camera', downloads: 2100
  },
  {
    id: 'arc-4',
    name: 'XTE_J1810_Transient_Radio_Burst_Archive.fits',
    size: '6.4 GB', date: '2024-01-10',
    telescope: 'Parkes Radio Telescope', downloads: 634
  },
  {
    id: 'arc-5',
    name: 'SGR_1935_FRB_Association_Multi_Band.tar.gz',
    size: '2.1 GB', date: '2024-03-22',
    telescope: 'CHIME / Swift Joint', downloads: 3100
  }
];
