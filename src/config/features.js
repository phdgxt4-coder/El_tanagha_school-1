/* Feature flags. Living layer is ON: the crew appears in the wired moments (auth help, welcome back, rare delights).
   To turn it off in one browser only: localStorage.setItem('sc.flag.living','0') then reload. Remove it to turn back on. */
export const FEATURES={living:true};
export function livingEnabled(){
  try{const v=localStorage.getItem('sc.flag.living');if(v==='0')return false;if(v==='1')return true;}catch{}
  return FEATURES.living;
}
