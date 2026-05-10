export type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
export type ModuleView = 'overview' | 'processing' | 'results' | 'approved';
export type DiagnosisVersion = 'original' | 'reprocesado';

export interface DomainScore { score: number; nivel: string; }

export interface MaturityGap {
  nombre: string;
  tipo: string;
  score: number;
  nivel: string;
  impacto_potencial: string;
}

export interface MaturityStrength {
  nombre: string;
  tipo: string;
  score: number;
  nivel: string;
}

export interface MaturityResult {
  level: number;
  score: number;
  gaps: MaturityGap[];
  fortalezas: MaturityStrength[];
  recommendations: string[];
  por_dominio?: Record<string, DomainScore>;
  por_fase?: Record<string, DomainScore>;
  por_factor?: Record<string, DomainScore>;
  patrones_estructurales?: string;
}

export interface TopGap { area: string; severity: 'critical' | 'high' | 'medium' | 'low'; }

export interface Tension { tipo: string; descripcion: string; impacto: string; }

export interface TemaRecurrente { tema: string; frecuencia: number; sintesis: string; relacion_con_brechas: string; }

export interface FullResults {
  agil?: MaturityResult;
  predictiva?: MaturityResult;
  overallLevel: number;
  overallLabel: string;
  overallScore: number;
  summary: string;
  timestamp: string;
  version: DiagnosisVersion;
  advertencias_de_entrada: string[];
  top_gaps: TopGap[];
  recommendations: string[];
  analisis_cruzado?: {
    aplica: boolean;
    perfil: string;
    coherencia: string;
    tensiones: Tension[];
  };
  analisis_cualitativo?: {
    total_respuestas_abiertas: number;
    temas_recurrentes: TemaRecurrente[];
  };
}

export type MaturityRow = {
  key: string;
  label: string;
  value: number;
  maturity: string;
};
