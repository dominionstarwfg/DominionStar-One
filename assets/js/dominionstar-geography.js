/* DominionStar public geographic context — voluntary, review-branch release. */
(() => {
  'use strict';
  const US = 'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|American Samoa|Guam|Northern Mariana Islands|Puerto Rico|U.S. Virgin Islands'.split('|');
  const CA = 'Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland and Labrador|Northwest Territories|Nova Scotia|Nunavut|Ontario|Prince Edward Island|Quebec|Saskatchewan|Yukon'.split('|');
  // IANA identifiers, not fixed UTC offsets: daylight-saving and legal changes may occur.
  const ZONES = [
    ['America/New_York','Eastern — New York / US East'],
    ['America/Toronto','Eastern — Toronto / Ontario'],
    ['America/Chicago','Central — Chicago / US Central'],
    ['America/Winnipeg','Central — Winnipeg / Manitoba'],
    ['America/Regina','Saskatchewan — Regina'],
    ['America/Denver','Mountain — Denver'],
    ['America/Edmonton','Mountain — Edmonton / Alberta'],
    ['America/Phoenix','Arizona — Phoenix (no seasonal change)'],
    ['America/Los_Angeles','Pacific — Los Angeles'],
    ['America/Vancouver','Pacific — Vancouver'],
    ['America/Anchorage','Alaska — Anchorage'],
    ['America/Adak','Aleutian — Adak'],
    ['Pacific/Honolulu','Hawaii — Honolulu'],
    ['America/Halifax','Atlantic — Halifax'],
    ['America/Moncton','Atlantic — Moncton'],
    ['America/Goose_Bay','Atlantic — Labrador'],
    ['America/St_Johns','Newfoundland — St. John’s'],
    ['America/Whitehorse','Yukon — Whitehorse'],
    ['America/Yellowknife','Northwest Territories — Yellowknife'],
    ['America/Iqaluit','Nunavut — Iqaluit'],
    ['America/Rankin_Inlet','Nunavut — Rankin Inlet'],
    ['America/Puerto_Rico','Puerto Rico / US Virgin Islands'],
    ['Pacific/Guam','Guam / Northern Mariana Islands'],
    ['Pacific/Pago_Pago','American Samoa']
  ];
  const params = new URLSearchParams(window.location.search);
  const getRegions = country => country === 'United States' ? US : country === 'Canada' ? CA : country === 'Other' ? ['Other / International'] : [];
  function fillRegion(countrySelect, regionSelect, proposedValue) {
    const values=getRegions(countrySelect.value);
    regionSelect.replaceChildren(new Option(values.length?'Select state, province or territory':'Select country first',''));
    values.forEach(name => regionSelect.add(new Option(name,name)));
    regionSelect.disabled=!values.length;
    const matching=values.find(v=>v===proposedValue);
    if(matching) regionSelect.value=matching;
  }
  function initPicker(scope) {
    const country=scope.querySelector('[data-ds-country]');
    const region=scope.querySelector('[data-ds-region]');
    if(!country||!region)return;
    // Query params are accepted only if they match an existing country/region option.
    const incomingCountry=params.get('country');
    if(incomingCountry && Array.from(country.options).some(o=>o.value===incomingCountry)) country.value=incomingCountry;
    const initial=params.get('region')||region.dataset.initialValue||region.value;
    fillRegion(country,region,initial);
    country.addEventListener('change',()=>{
      fillRegion(country,region,'');
      region.dispatchEvent(new Event('change',{bubbles:true}));
    });
    return {country,region};
  }
  function initTimeZone(form) {
    const select=form.querySelector('[data-ds-timezone]');
    if(!select)return;
    let detected='';
    try{detected=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch{}
    ZONES.forEach(([value,label])=>select.add(new Option(label,value)));
    if(detected&&!ZONES.some(([value])=>value===detected)){
      try {
        new Intl.DateTimeFormat('en-US',{timeZone:detected});
        select.add(new Option('My device time zone — '+detected,detected));
      }catch{}
    }
    if(detected && Array.from(select.options).some(o=>o.value===detected)) select.value=detected;
    const help=form.querySelector('[data-ds-tz-feedback]');
    function refresh() {
      if(!help)return;
      if(!select.value){help.textContent='Choose the time zone for your requested appointment.';return;}
      try{
        const formatted=new Intl.DateTimeFormat('en-US',{timeZone:select.value,weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date());
        help.textContent='Current time there: '+formatted+'. Please confirm this matches your preferred appointment time zone.';
      }catch{help.textContent='Please verify your selected time zone.';}
    }
    select.addEventListener('change',refresh);
    refresh();
  }
  document.querySelectorAll('form.inquiry-card').forEach(form=>{
    initPicker(form);
    initTimeZone(form);
  });
  const panel=document.querySelector('[data-ds-geography]');
  if(panel){
    const picker=initPicker(panel);
    const output=panel.querySelector('[data-ds-jurisdiction-text]');
    const link=panel.querySelector('[data-ds-jurisdiction-link]');
    if(picker&&output&&link){
      function update(){
        const country=picker.country.value, region=picker.region.value;
        if(!country||!region){
          output.textContent='Choose your location to see jurisdiction-aware guidance. Exact coverage, policy forms, riders and product eligibility require verification.';
          link.href='/consultation/';
          return;
        }
        if(country==='Canada'){
          output.textContent=region+': Canadian licensing, product eligibility and insurer offerings are provincial or territorial. U.S. product features should not be assumed available in Canada. Our team can review your inquiry and confirm the appropriate next step.';
        }else if(country==='United States'){
          const focus=['New York','Connecticut','Kentucky'].includes(region)
            ? ' Living-benefit and long-term-care terms must be assessed separately; neither should be assumed available in a particular carrier contract.'
            : '';
          output.textContent=region+': Life insurance policy forms and optional riders can vary by state, carrier and plan. Any available living benefits or long-term-care provisions must be confirmed against the approved contract and by an appropriately licensed professional.'+focus;
        }else{
          output.textContent='For locations outside the United States and Canada, service and product availability must be confirmed before any specific guidance is offered.';
        }
        link.href='/consultation/?'+new URLSearchParams({country,region}).toString();
      }
      picker.country.addEventListener('change',update);
      picker.region.addEventListener('change',update);
      update();
    }
  }
})();