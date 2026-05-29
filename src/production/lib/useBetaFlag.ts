// Read the production_beta_enabled flag off the existing settings singleton.
// No CRM store changes — read straight from Supabase to avoid touching AppProvider.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function useProductionBetaEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('production_beta_enabled')
        .eq('id', 'config')
        .single();
      if (!cancel) setEnabled(Boolean(data?.production_beta_enabled));
    })();
    return () => { cancel = true; };
  }, []);

  return enabled;
}
