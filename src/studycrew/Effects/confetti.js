/* Effects entry point. Wraps the site's existing lazy celebrate() so the framework has one place to swap effects. */
import {CONFIG} from '../Shared/config.js';
export async function confetti(anchor,count=CONFIG.budget.maxParticles){
  const {celebrate}=await import('../../ui/celebrate.js');
  celebrate(anchor,count);
}
