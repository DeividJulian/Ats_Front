import { Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';

const page = (title: string) => `${title} · Portal ATS`;

export const routes: Routes = [
  // Public
  { path: '', title: 'Portal ATS · Encuentra al candidato ideal', loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing) },
  { path: 'empleos/:id', title: page('Vacante'), loadComponent: () => import('./pages/public-job/public-job').then((m) => m.PublicJobPage) },
  { path: 'login', title: page('Iniciar sesión'), canActivate: [guestGuard], loadComponent: () => import('./pages/auth/login').then((m) => m.Login) },
  { path: 'registro', title: page('Crear cuenta'), canActivate: [guestGuard], loadComponent: () => import('./pages/auth/register').then((m) => m.Register) },

  // Recruiters and administrators
  {
    path: 'app',
    canActivate: [authGuard, roleGuard('admin', 'recruiter')],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', title: page('Panel'), loadComponent: () => import('./pages/staff/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'vacantes', title: page('Vacantes'), loadComponent: () => import('./pages/staff/jobs/jobs').then((m) => m.Jobs) },
      { path: 'vacantes/nueva', title: page('Nueva vacante'), loadComponent: () => import('./pages/staff/job-form/job-form').then((m) => m.JobForm) },
      { path: 'vacantes/:id', title: page('Vacante'), loadComponent: () => import('./pages/staff/job-detail/job-detail').then((m) => m.JobDetail) },
      { path: 'vacantes/:id/editar', title: page('Editar vacante'), loadComponent: () => import('./pages/staff/job-form/job-form').then((m) => m.JobForm) },
      { path: 'ranking', title: page('Ranking'), loadComponent: () => import('./pages/staff/ranking/ranking').then((m) => m.Ranking) },
      { path: 'candidatos', title: page('Candidatos'), loadComponent: () => import('./pages/staff/candidates/candidates').then((m) => m.Candidates) },
      { path: 'candidatos/nuevo', title: page('Registrar candidato'), loadComponent: () => import('./pages/staff/candidates/candidate-new').then((m) => m.CandidateNew) },
      { path: 'candidatos/:id', title: page('Candidato'), loadComponent: () => import('./pages/staff/candidate-detail/candidate-detail').then((m) => m.CandidateDetail) },
      { path: 'analisis', title: page('Análisis masivo'), loadComponent: () => import('./pages/staff/bulk-analysis/bulk-analysis').then((m) => m.BulkAnalysis) },
      { path: 'usuarios', title: page('Usuarios'), canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/staff/users/users').then((m) => m.Users) },
    ],
  },

  // Candidates
  {
    path: 'portal',
    canActivate: [authGuard, roleGuard('candidate')],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', title: page('Inicio'), loadComponent: () => import('./pages/portal/home/home').then((m) => m.PortalHome) },
      { path: 'vacantes', title: page('Vacantes'), loadComponent: () => import('./pages/portal/jobs/jobs').then((m) => m.PortalJobs) },
      { path: 'postulaciones', title: page('Mis postulaciones'), loadComponent: () => import('./pages/portal/applications/applications').then((m) => m.PortalApplications) },
      { path: 'perfil', title: page('Mi perfil'), loadComponent: () => import('./pages/portal/profile/profile').then((m) => m.PortalProfile) },
    ],
  },

  { path: '**', title: page('Página no encontrada'), loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound) },
];
