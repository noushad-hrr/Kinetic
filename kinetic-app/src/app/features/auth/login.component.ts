import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-surface dark:bg-[#0a0a0a] flex items-center justify-center p-6">
      <div class="w-full max-w-[440px] flex flex-col items-center">

        <!-- Brand -->
        <header class="mb-10 text-center">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary-container mb-4 ambient-lift">
            <span class="material-symbols-outlined text-white text-2xl" style="font-variation-settings:'FILL' 1;">bolt</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-on-surface dark:text-slate-100">Kinetic</h1>
          <p class="text-on-surface-variant dark:text-slate-400 text-sm mt-1">Sign in to your editorial workspace</p>
        </header>

        <!-- Card -->
        <main class="w-full bg-surface-container-lowest dark:bg-neutral-900 dark:border-zinc-700 rounded-xl p-8 ambient-lift ghost-border">
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-6">

            <!-- Error -->
            @if (errorMsg()) {
              <div class="p-4 rounded-lg bg-error-container/50 flex items-start gap-3">
                <span class="material-symbols-outlined text-error mt-0.5 text-xl">error</span>
                <div>
                  <p class="text-on-error-container text-2xs font-bold uppercase tracking-wider">Invalid Credentials</p>
                  <p class="text-on-error-container text-sm">{{ errorMsg() }}</p>
                </div>
              </div>
            }

            <div class="space-y-4">
              <!-- Username -->
              <div class="space-y-1.5">
                <label class="k-label" for="username">USERNAME</label>
                <input id="username" type="text" formControlName="username" placeholder="name@kinetic.com"
                       class="k-input"
                       [class.ring-2]="form.get('username')?.invalid && form.get('username')?.touched"
                       [class.ring-error]="form.get('username')?.invalid && form.get('username')?.touched" />
                @if (form.get('username')?.invalid && form.get('username')?.touched) {
                  <p class="text-error text-xs">Username is required</p>
                }
              </div>

              <!-- Password -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between ml-1">
                  <label class="k-label" for="password">PASSWORD</label>
                </div>
                <div class="relative">
                  <input id="password" [type]="showPwd() ? 'text' : 'password'" formControlName="password"
                         placeholder="••••••••" class="k-input pr-12"
                         [class.ring-2]="form.get('password')?.invalid && form.get('password')?.touched"
                         [class.ring-error]="form.get('password')?.invalid && form.get('password')?.touched" />
                  <button type="button" (click)="showPwd.set(!showPwd())"
                          class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1">
                    <span class="material-symbols-outlined text-xl">{{ showPwd() ? 'visibility_off' : 'visibility' }}</span>
                  </button>
                </div>
                @if (form.get('password')?.invalid && form.get('password')?.touched) {
                  <p class="text-error text-xs">Password is required</p>
                }
              </div>
            </div>

            <!-- Submit -->
            <button type="submit" class="btn-primary w-full justify-center"
                    [disabled]="loading()">
              @if (loading()) {
                <span class="material-symbols-outlined text-sm animate-spin">refresh</span>
                Signing in...
              } @else {
                <span>Continue to Workspace</span>
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
              }
            </button>
          </form>
        </main>

        <!-- Footer -->
        <footer class="mt-8 flex flex-col items-center gap-4">
          <nav class="flex gap-6 opacity-60">
            <span class="text-2xs font-medium text-on-surface tracking-wider">KINETIC v1.0</span>
          </nav>
        </footer>
      </div>
    </div>
  `
})
export class LoginComponent {
  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  loading = signal(false);
  errorMsg = signal('');
  showPwd = signal(false);

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { username, password } = this.form.value;
    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.login(username!, password!).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/tasks-manager/tasks'], { queryParams: { view: 'day' } });
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.errorMsg.set(err.message || 'Login failed. Please try again.');
      }
    });
  }
}
