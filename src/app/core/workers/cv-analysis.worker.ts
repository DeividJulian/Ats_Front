/// <reference lib="webworker" />
/**
 * WEB WORKER: runs the bulk resume analysis on a separate thread,
 * so the interface (main thread) never freezes.
 */
import { AnalysisJob, analyze } from './cv-analysis.logic';

addEventListener('message', ({ data }: MessageEvent<AnalysisJob>) => {
  try {
    const output = analyze(data, (progress) => postMessage({ type: 'progress', progress }));
    postMessage({ type: 'result', output });
  } catch (error) {
    postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Error en el análisis' });
  }
});
