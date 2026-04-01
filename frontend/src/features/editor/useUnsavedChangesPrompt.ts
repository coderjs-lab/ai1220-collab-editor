import { useBeforeUnload } from 'react-router-dom';

export function useUnsavedChangesPrompt(isDirty: boolean) {
  useBeforeUnload(
    (event) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    },
    { capture: true },
  );
}
