import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TOKEN_KEY, USER_KEY } from '../core/auth/auth.service';
import { USER, fakeToken } from '../../testing/fixtures';
import { Shell } from './shell';

describe('Shell', () => {
  async function open() {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, fakeToken(Math.floor(Date.now() / 1000) + 3600));
    localStorage.setItem(USER_KEY, JSON.stringify(USER));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(Shell);
    TestBed.inject(HttpTestingController).match(() => true);
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  it('offers a link to skip straight to the content', async () => {
    const { page } = await open();
    const skip = page.querySelector<HTMLAnchorElement>('a.skip-link')!;
    expect(skip.getAttribute('href')).toBe('#contenido');
    expect(page.querySelector('main#contenido')).not.toBeNull();
  });

  it('closes the user menu with Escape', async () => {
    const { fixture, page } = await open();
    page.querySelector<HTMLButtonElement>('.avatar-btn')!.click();
    fixture.detectChanges();
    expect(page.querySelector('.menu')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(page.querySelector('.menu')).toBeNull();
  });
});
