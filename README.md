# Portal ATS para pymes — Frontend

Interfaz web del sistema de selección de personal: una página de inicio con la bolsa de empleo, login sin contraseña (código por correo) con roles, el panel del equipo de selección y el portal del candidato. Diseño hecho en Claude Design, claro y cálido, con modo oscuro, pensado primero para el celular (con barra de navegación inferior) y adaptado a escritorio. Se comunica con el [backend en FastAPI](https://github.com/DeividJulian/Ats_Backend).

Proyecto final de Programación Orientada a la Web — Universidad Cooperativa de Colombia.

## Tecnologías

- Angular 21 (componentes standalone, signals, rutas con carga diferida)
- Sistema de diseño propio en `src/styles.css` (tokens de color, tipografía, componentes) con modo claro y oscuro
- Formularios reactivos con validación
- Íconos de línea de [Lucide](https://lucide.dev)
- Vitest para pruebas
- Web Worker, Shared Worker y Service Worker
- Despliegue en Vercel

El código está en inglés; todo lo que ve el usuario está en español.

## Roles

| Rol | Qué ve |
|---|---|
| Visitante | Página de inicio, vacantes abiertas, detalle de cada vacante, registro y login |
| Candidato | Su inicio (perfil, recomendaciones), vacantes con su nivel de ajuste (y filtro "solo las que encajan"), sus postulaciones con línea de tiempo y su perfil (con carga de hoja de vida en PDF, que debe ser suya) |
| Reclutador | Panel (embudo, demanda vs. disponibilidad, mejores puntajes, estado de la IA), vacantes en tarjetas o tabla (con redacción por IA y enlace público para compartir), detalle de cada vacante con la revisión de cada postulante (desglose, guía de entrevista, evaluación con IA), ranking comparativo exportable a CSV, candidatos (registro en su propia página, extracción desde texto o PDF) y análisis masivo |
| Administrador | Todo lo del reclutador, más usuarios y roles (filtros por rol y estado, envío del código de acceso) y carga de datos de demostración |

### Inicio de sesión

No hay contraseñas. En **Iniciar sesión** la persona escribe su correo y le llega un código de 6 dígitos para entrar; en **Crear cuenta** (solo candidatos) escribe su nombre y correo, y el código activa la cuenta. El paso del código es un componente compartido (`pages/auth/code-step.ts`): se envía solo al pegar los 6 dígitos, tiene botón para abrir Gmail u Outlook, botón para reenviar y una cuenta regresiva de 30 segundos, la misma espera que exige el backend. Si el correo no tiene cuenta, el login ofrece crearla con ese mismo correo.

- `AuthService` guarda la sesión en `localStorage` (si el navegador lo bloquea, dura hasta recargar) y la descarta si el token ya venció. Al abrir la app confirma la sesión con `GET /auth/me`.
- El interceptor agrega `Authorization: Bearer <token>` solo a las peticiones del backend y, ante un 401 fuera de las pantallas de login, cierra la sesión y lleva al login.
- `authGuard`, `roleGuard` y `guestGuard` protegen las rutas según la sesión y el rol.
- Al cerrar sesión se borran las respuestas del API que guardó el Service Worker, para que otra persona no las vea en ese navegador.

### Otros detalles

- **Formularios:** la vacante, el registro de candidato y *Mi perfil* avisan antes de salir con cambios sin guardar.
- **Accesibilidad:** enlace "Saltar al contenido", foco visible (también en la zona para subir PDF), menús que se cierran con Escape y textos para lectores de pantalla en los puntajes.
- **Errores:** mensajes en español; tras un 429 se indica cuántos segundos esperar y, si el servidor gratis está despertando, se dice así en vez de "Error 503".
- **Tema:** el modo oscuro sigue al sistema mientras la persona no elija uno, y la barra del navegador en el celular toma el color de la página.
- Página 404 propia para enlaces que no existen.

## Los tres workers

| Worker | Archivo | Para qué |
|---|---|---|
| **Web Worker** | `src/app/core/workers/cv-analysis.worker.ts` | El análisis masivo de hojas de vida (hasta 50.000, con NLP, TF-IDF y puntaje) corre en un hilo aparte. La página *Análisis masivo* muestra los FPS en vivo y **mide** cuánto se congela la pantalla en cada modo: por ejemplo, con 25.000 hojas de vida el hilo principal se congeló 1.150 ms y el Web Worker 17 ms. También agrupa por percentil y exporta a CSV. |
| **Shared Worker** | `public/shared-worker.js` | Une todas las pestañas abiertas: cuando una cambia datos, las demás se actualizan solas y aparece un contador de pestañas sincronizadas. |
| **Service Worker** | `public/sw.js` | La app abre sin conexión y muestra los últimos datos guardados. Al cerrar sesión se borran, para que nadie más los vea en ese navegador. Solo se activa en la versión compilada (no con `ng serve`). |

## Estructura

```
src/app/
├── core/
│   ├── auth/          # Sesión (JWT), interceptor y guardas por rol
│   ├── config/        # URL del backend
│   ├── models/        # Tipos de las respuestas de la API
│   ├── services/      # Un servicio por recurso de la API
│   ├── utils/         # Errores, etiquetas en español, CSV y portapapeles
│   └── workers/       # Web Worker, Shared Worker, Service Worker y lógica del análisis
├── layout/            # Cabecera pública y marco del área privada (menú por rol)
├── pages/
│   ├── landing/       # Página de inicio
│   ├── public-job/    # Detalle público de una vacante
│   ├── auth/          # Login, registro y paso del código
│   ├── not-found/     # Página 404
│   ├── staff/         # Panel, vacantes, ranking (tablero reutilizable), candidatos, análisis masivo, usuarios
│   └── portal/        # Inicio, vacantes, postulaciones y perfil del candidato
└── shared/            # Componentes reutilizables (íconos, modal, barra de puntaje, carga de PDF…)
```

## Ejecutar en local

Necesitas Node 20.19 o superior y el backend corriendo en el puerto 8001:

```
# En la carpeta del backend
uvicorn main:app --reload --port 8001

# En esta carpeta
npm install
npm start
```

Abre http://localhost:4200. En local el front usa `http://127.0.0.1:8001`; publicado usa la URL de Render configurada en `src/app/core/config/api.config.ts`.

## Pruebas

```
npm test -- --watch=false
```

147 pruebas: sesión, interceptor y guardas de rutas (incluida la de cambios sin guardar), servicios de la API, lógica del análisis (con los mismos casos que el backend), workers y cachés, paso del código, páginas (inicio, login, registro, vacante pública, panel, usuarios, 404), exportaciones a CSV, tema, avisos y utilidades.

## Desplegar en Vercel

1. En `src/app/core/config/api.config.ts` pon la URL de tu backend en Render en `PRODUCTION_API`.
2. Entra a [vercel.com](https://vercel.com) con GitHub, **Add New → Project** y elige este repositorio. Vercel detecta Angular solo.
3. Al terminar, copia la URL del front y ponla en el backend (Render → Environment → `ALLOWED_ORIGINS`).

`vercel.json` hace que las rutas internas (por ejemplo `/app/vacantes`) funcionen al recargar la página.
