// client/src/appeal/FormContext.js — the context of the form and the hook that reads it.
import { createContext, useContext } from 'react';

export const FormContext = createContext(null);

export function useFormContext() {
  const context = useContext(FormContext);
  if (context === null) {
    throw new Error('useFormContext must be used inside <FormContext.Provider>.');
  }
  return context;
}
