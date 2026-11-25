/* One character per spot. A higher priority claim takes the spot; the loser is told to hide. */
const slots=new Map();
export function claimSlot(name,owner,priority=0,onPreempt=()=>{}){
  const cur=slots.get(name);
  if(cur&&cur.owner!==owner&&cur.priority>priority)return false;
  if(cur&&cur.owner!==owner)cur.onPreempt();
  slots.set(name,{owner,priority,onPreempt});
  return true;
}
export function releaseSlot(name,owner){
  const cur=slots.get(name);
  if(cur&&cur.owner===owner)slots.delete(name);
}
export const slotOwner=name=>slots.get(name)?.owner??null;
export const slotCount=()=>slots.size;
