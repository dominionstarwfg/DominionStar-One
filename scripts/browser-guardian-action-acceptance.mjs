import { chromium } from 'playwright';

const baseURL=process.env.DOMINIONSTAR_PREVIEW_URL||'http://127.0.0.1:4173';
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:780}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error?.stack||error?.message||error)));

try{
  await page.goto(`${baseURL}/meet/`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>{
    const actions=window.DominionGuardianActions;
    const guardian=window.DominionGuardianObserver;
    if(!actions||!guardian)return false;
    const h=actions.health?.();
    const gh=guardian.health?.();
    return h?.catalogSize>60&&Array.isArray(h?.missingRequired)&&h.missingRequired.length===0&&Boolean(gh?.services?.actions);
  },null,{timeout:10000});

  const initial=await page.evaluate(()=>({
    actionHealth:window.DominionGuardianActions.health(),
    guardianHealth:window.DominionGuardianObserver.health(),
    catalog:window.DominionGuardianActions.catalog()
  }));
  assert(initial.actionHealth.status==='healthy',`Guardian action service unhealthy: ${JSON.stringify(initial.actionHealth)}`);
  assert(initial.actionHealth.missingRequired.length===0,`Guardian required action surface incomplete: ${JSON.stringify(initial.actionHealth.missingRequired)}`);
  for(const service of ['eventBus','meeting','actions','recovery','resilience','certification']){
    assert(initial.guardianHealth.services?.[service],`Guardian did not register ${service} service`);
  }
  for(const id of ['toolbar.ai-notes','toolbar.host-tools','share.pause-resume','leave.end-all','dynamic.waiting-admit','dynamic.participant-more']){
    assert(initial.catalog.some(item=>item.id===id),`Guardian catalog missing ${id}`);
  }

  await page.evaluate(()=>window.DominionGuardianActions.clear());

  // Exercise real, non-destructive UI actions. These assertions prove the
  // application handler ran as well as Guardian's capture observer.
  await page.locator('#preSettings').click();
  await page.waitForFunction(()=>document.getElementById('settingsDialog')?.open===true);
  await page.locator('#settingsDialog button[value="cancel"]').click();
  await page.waitForFunction(()=>document.getElementById('settingsDialog')?.open===false);

  await page.locator('#scheduleMeetingAction').click();
  await page.waitForFunction(()=>document.getElementById('scheduleDialog')?.open===true);
  await page.locator('#scheduleRecurring').check();
  await page.waitForFunction(()=>document.getElementById('recurrenceOptions')?.hidden===false);
  await page.locator('#scheduleCancel').click();
  await page.waitForFunction(()=>document.getElementById('scheduleDialog')?.open===false);

  await page.locator('#personalMeetingAction').click();
  await page.waitForFunction(()=>document.getElementById('personalRoomDialog')?.open===true);
  await page.locator('#personalRoomClose').click();
  await page.waitForFunction(()=>document.getElementById('personalRoomDialog')?.open===false);

  // Dynamic participant action families are created at runtime. Probe the
  // capture contract with a harmless unknown participant; the established
  // meeting handler safely ignores it because no participant record exists.
  await page.evaluate(()=>{
    const button=document.createElement('button');
    button.id='guardianDynamicProbe';
    button.dataset.quickMic='guardian-missing-participant';
    document.body.append(button);
    button.click();
    button.remove();
  });

  await page.locator('#joinMeetingAction').click();
  await page.waitForFunction(()=>document.activeElement?.id==='roomId');

  const observed=await page.evaluate(()=>({
    snap:window.DominionGuardianActions.snapshot(),
    events:window.DominionGuardianObserver.recent(120).filter(item=>item.type==='guardian.action.invoked'),
    report:window.DominionGuardianCertification.run({publishEvent:false})
  }));

  const expected=[
    'prejoin.settings','settings.close','prejoin.schedule','schedule.recurring','schedule.cancel',
    'prejoin.personal-room','personal.close','dynamic.participant-mic','prejoin.join'
  ];
  for(const id of expected){
    assert((observed.snap.counts?.[id]||0)>=1,`Guardian did not observe real action ${id}: ${JSON.stringify(observed.snap.counts)}`);
    assert(observed.events.some(event=>event.payload?.id===id),`Guardian event bus did not receive ${id}`);
  }

  const actionSurface=observed.report.checks.find(check=>check.id==='action-surface');
  const actionApi=observed.report.checks.find(check=>check.id==='guardian-actions');
  assert(actionSurface?.status==='pass',`Guardian action surface certification failed: ${JSON.stringify(actionSurface)}`);
  assert(actionApi?.status==='pass',`Guardian action API certification failed: ${JSON.stringify(actionApi)}`);
  assert(observed.report.actions?.missingRequired?.length===0,'Guardian certification reports missing required actions');
  assert(errors.length===0,`Guardian action acceptance produced page errors:\n${errors.join('\n---\n')}`);

  console.log(`GUARDIAN_ACTION_CATALOG_SIZE=${observed.snap.catalogSize}`);
  console.log(`GUARDIAN_ACTION_TYPES_OBSERVED=${observed.snap.observedActionTypes}`);
  console.log(`GUARDIAN_ACTION_INVOCATIONS=${observed.snap.invocations}`);
  console.log('DOMINIONSTAR_GUARDIAN_ACTION_ACCEPTANCE_OK');
} finally {
  await context.close();
  await browser.close();
}
