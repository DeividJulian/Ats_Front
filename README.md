# Portal ATS para pymes — Frontend

Interfaz web del sistema de selección de personal: una página de inicio con la bolsa de empleo, login sin contraseña (código por correo) con roles, el panel del equipo de selección y el portal del candidato. Diseño claro y cálido, pensado primero para el celular (con barra de navegación inferior) y adaptado a escritorio. Se comunica con el [backend en FastAPI](https://github.com/DeividJulian/Ats_Backend).

Proyecto final de Programación Orientada a la Web — Universidad Cooperativa de Colombia.

## Tecnologías

- Angular 21 (componentes standalone, signals, rutas con carga diferida)
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
| Candidato | Su inicio (perfil, recomendaciones), vacantes con su nivel de ajuste, sus postulaciones con línea de tiempo y su perfil (con carga de hoja de vida en PDF) |
| Reclutador | Panel (embudo, demanda vs. disponibilidad de habilidades, resultados por vacante), vacantes (con redacción por IA), ranking de candidatos (modo anónimo, avance de estado, evaluación con IA, vincular y sugeridos), candidatos (extracción del perfil desde texto o PDF), guía de entrevista y análisis masivo |
| Administrador | Todo lo del reclutador, más usuarios y roles, y carga de datos de demostración |

### Inicio de sesión

No hay contraseñas. En **Iniciar sesión** la persona escribe su correo y le llega un código de 6 dígitos para entrar; en **Crear cuenta** (solo candidatos) escribe su nombre y correo, y el código activa la cuenta. El paso del código es un componente compartido (`pages/auth/code-step.ts`) con botón para reenviar y una cuenta regresiva de 30 segundos, la misma espera que exige el backend.

- `AuthService` guarda la sesión en `localStorage` (si el navegador lo bloquea, dura hasta recargar) y la descarta si el token ya venció. Al abrir la app confirma la sesión con `GET /auth/me`.
- El interceptor agrega `Authorization: Bearer <token>` solo a las peticiones del backend y, ante un 401 fuera de las pantallas de login, cierra la sesión y lleva al login.
- `authGuard`, `roleGuard` y `guestGuard` protegen las rutas según la sesión y el rol.
- Al cerrar sesión se borran las respuestas del API que guardó el Service Worker, para que otra persona no las vea en ese navegador.

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
│   ├── utils/         # Errores y etiquetas en español
│   └── workers/       # Web Worker, Shared Worker, Service Worker y lógica del análisis
├── layout/            # Cabecera pública y marco del área privada (menú por rol)
├── pages/
│   ├── landing/       # Página de inicio
│   ├── public-job/    # Detalle público de una vacante
│   ├── auth/          # Login, registro y paso del código
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

87 pruebas: sesión, interceptor y guardas de rutas, servicios de la API, lógica del análisis (con los mismos casos que el backend), workers, página de inicio, login, exportación CSV y utilidades.

## Desplegar en Vercel

1. En `src/app/core/config/api.config.ts` pon la URL de tu backend en Render en `PRODUCTION_API`.
2. Entra a [vercel.com](https://vercel.com) con GitHub, **Add New → Project** y elige este repositorio. Vercel detecta Angular solo.
3. Al terminar, copia la URL del front y ponla en el backend (Render → Environment → `ALLOWED_ORIGINS`).

`vercel.json` hace que las rutas internas (por ejemplo `/app/vacantes`) funcionen al recargar la página.
