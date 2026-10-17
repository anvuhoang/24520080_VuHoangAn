/**
 * Exercise 3 — TypeScript Types & Discriminated Union
 * Resilient State Machine & Skeleton Loader
 */

export type StateStatus = 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR';

export type ViewState<T> =
  | { status: 'IDLE' }
  | { status: 'LOADING' }
  | { status: 'SUCCESS'; data: T }
  | { status: 'ERROR'; error: string };

export interface ProjectItem {
  id: string | number;
  title: string;
  category: string;
  description: string;
  badge?: string;
}
