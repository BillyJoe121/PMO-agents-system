import type { ElementType } from 'react';

type PmoType = 'Ágil' | 'Híbrida' | 'Predictiva';
type ModuleView = 'auto-trigger' | 'processing' | 'results' | 'approved' | 'error';

interface ProcessingStep {
  id: number;
  label: string;
  detail: string;
  durationMs: number;
}

interface DocVersion {
  number: number;
  generatedAt: string; // ISO string
  comment?: string;    // comentario que disparó esta versión (null = original)
  status: 'generado' | 'revisado';
  data?: any;
}

interface GuideChapter {
  number: number;
  icon: ElementType;
  title: string;
  intro: string;
  subsections: {
    title: string;
    content: string;
    items?: string[];
    table?: { headers: string[]; rows: string[][] };
  }[];
}

type GuideSubsection = GuideChapter['subsections'][number];

export type { PmoType, ModuleView, ProcessingStep, DocVersion, GuideChapter, GuideSubsection };
