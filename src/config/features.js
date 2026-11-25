/* Feature flags. Living layer is OFF by default: the live app is unchanged until this is set to true.
   For testing in one browser only: localStorage.setItem('sc.flag.living','1') then reload. Remove it to turn off. */
export const FEATURES={living:false};
export function livingEnabled(){
  if(FEATURES.living)return true;
  try{return localStorage.getItem('sc.flag.living')==='1';}catch{return false;}
}
