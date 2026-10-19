import { Pipe, PipeTransform } from '@angular/core';

import {
  aiProviderLabel,
  areaLabel,
  breakdownLabel,
  classificationLabel,
  educationLabel,
  jobStatusLabel,
  questionTypeLabel,
  recommendationLabel,
  roleLabel,
  statusLabel,
} from '../core/utils/labels';

export type LabelKind =
  | 'status'
  | 'jobStatus'
  | 'education'
  | 'classification'
  | 'role'
  | 'area'
  | 'breakdown'
  | 'recommendation'
  | 'questionType'
  | 'aiProvider';

const LABELS: Record<LabelKind, (code: string) => string> = {
  status: statusLabel,
  jobStatus: jobStatusLabel,
  education: educationLabel,
  classification: classificationLabel,
  role: roleLabel,
  area: areaLabel,
  breakdown: breakdownLabel,
  recommendation: recommendationLabel,
  questionType: questionTypeLabel,
  aiProvider: aiProviderLabel,
};

/** Shows an API code in Spanish: {{ 'shortlisted' | label: 'status' }} -> "Preseleccionado". */
@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(code: string | null | undefined, kind: LabelKind): string {
    return LABELS[kind](code ?? '');
  }
}
