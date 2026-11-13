// client/src/sprint2-form/FormContext.js
import { createContext, useContext } from 'react';

export const FormContext = createContext(null);

export function useFormContext() {
  const context = useContext(FormContext);
  if (context === null) {
    throw new Error('useFormContext must be used inside <FormContext.Provider>.');
  }
  return context;
}
