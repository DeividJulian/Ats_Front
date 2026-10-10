import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { LucideIconData } from 'lucide-angular';

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Builds the SVG markup of a Lucide icon (static data that ships with the library). */
export function iconSvg(icon: LucideIconData, size: number, stroke: number): string {
  const children = icon
    .map(([tag, attrs]) => {
      const list = Object.entries(attrs)
        .filter(([name]) => name !== 'key')
        .map(([name, value]) => `${name}="${escape(String(value))}"`)
        .join(' ');
      return `<${tag} ${list}/>`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`
  );
}

/** Line icon: <app-icon [icon]="Briefcase" />. It takes the color of the surrounding text. */
@Component({
  selector: 'app-icon',
  template: `<span class="app-icon" [innerHTML]="svg()"></span>`,
  styles: `
    :host { display: inline-flex; flex: none; line-height: 0; }
    .app-icon { display: inline-flex; }
  `,
  host: { 'aria-hidden': 'true' },
})
export class Icon {
  private readonly sanitizer = inject(DomSanitizer);

  readonly icon = input.required<LucideIconData>();
  readonly size = input(18);
  readonly stroke = input(2);

  // The markup comes only from the icon library's static data, never from users
  protected readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(iconSvg(this.icon(), this.size(), this.stroke())),
  );
}
