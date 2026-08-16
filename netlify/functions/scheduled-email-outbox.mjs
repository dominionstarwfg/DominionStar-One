import processOutbox from './process-email-outbox.mjs';
export const config={schedule:'* * * * *'};
export default async()=>processOutbox({method:'POST',httpMethod:'POST',headers:new Headers({'x-dominionstar-secret':process.env.EMAIL_PROCESSOR_SECRET||''})});
