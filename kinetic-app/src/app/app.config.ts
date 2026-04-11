import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { loadingInterceptor } from './interceptors/loading.interceptor';
import { ThemeService } from './services/theme.service';

function themeInit(_theme: ThemeService) {
  return () => Promise.resolve();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([loadingInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: themeInit,
      deps: [ThemeService],
      multi: true,
    },
  ]
};
