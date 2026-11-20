// client/src/dossier/dossierApi.js
import { readJson } from '../api.js';

export const fetchDossiers = ({ signal } = {}) => fetch('/api/dossiers', { signal }).then(readJson);
