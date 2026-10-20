import { Pipe, PipeTransform } from '@angular/core';

/** "1 año", "3 años": the number of years with the right word. */
export function yearsLabel(years: number | null | undefined): string {
  const n = years ?? 0;
  return `${n} ${n === 1 ? 'año' : 'años'}`;
}

@Pipe({ name: 'years' })
export class YearsPipe implements PipeTransform {
  transform(years: number | null | undefined): string {
    return yearsLabel(years);
  }
}
