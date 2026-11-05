// DominionStar One — review-only priority email routing contract.
// This is a pure policy helper, not a sender or a Supabase API endpoint.
// The corresponding SQL draft is NOT active until staged/approved.
export const PRIORITY_EMAIL_EVENTS = Object.freeze({
  account: Object.freeze(['account.approved','account.suspended','account.access_changed','security.alert']),
  appointments: Object.freeze(['appointment.confirmed','appointment.rescheduled','appointment.cancelled']),
  meetings: Object.freeze(['meeting.host_absent','meeting.cancelled','meeting.rescheduled']),
  messages: Object.freeze(['message.received','call.missed']),
  community: Object.freeze(['community.mention','community.reply'])
});
const normalize=value=>String(value??'').trim().toLowerCase();
export function priorityEmailCategory(eventType,priority='normal'){
  const type=normalize(eventType);
  for(const [category,events] of Object.entries(PRIORITY_EMAIL_EVENTS)){
    if(events.includes(type))return category;
  }
  if(['founder.urgent','founder.critical','announcement.urgent','announcement.critical'].includes(type))return 'announcements';
  if(['founder.announcement','announcement.published'].includes(type)
    && ['high','critical'].includes(normalize(priority)))return 'announcements';
  return null; // Never email likes, reactions, routine activity or unknown events.
}
export function priorityEmailDecision({
  eventType,priority='normal',preferences=null,verifiedEmail=false
}={}){
  const category=priorityEmailCategory(eventType,priority);
  if(!category)return {allowed:false,reason:'not_priority_email',category:null};
  if(!verifiedEmail)return {allowed:false,reason:'no_verified_email',category};
  const prefs=preferences??{};
  if(prefs.email_enabled===false)return {allowed:false,reason:'email_disabled',category};
  const preference={
    account:null,
    announcements:['announcements_email_enabled',true],
    appointments:['appointments_email_enabled',true],
    meetings:['meeting_room_email_enabled',true],
    messages:['messages_email_enabled',false],
    community:['community_email_enabled',false]
  }[category];
  if(preference){
    const [field,defaultValue]=preference;
    const permitted=typeof prefs[field]==='boolean'?prefs[field]:defaultValue;
    if(!permitted)return {allowed:false,reason:'category_opted_out',category};
  }
  return {allowed:true,reason:'eligible',category};
}

/** Deliver only to official DominionStar links, never caller-supplied domains. */
export function safeDominionStarEmailUrl(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{
    const url=new URL(value,'https://dominionstarld.com');
    return url.protocol==='https:'&&url.origin==='https://dominionstarld.com'
      ? url.href:null;
  }catch{return null;}
}
