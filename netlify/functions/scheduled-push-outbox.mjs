import processPushOutbox from './process-push-outbox.mjs';
export const config={schedule:'* * * * *'};
export default async()=>processPushOutbox({
  method:'POST',
  httpMethod:'POST',
  headers:new Headers({'x-dominionstar-secret':process.env.PUSH_PROCESSOR_SECRET||''})
});
