/* Legacy compatibility entry point. The canonical implementation is notifications-center.js. */
(() => {
  if (document.getElementById('notificationApp') && !document.querySelector('script[src*="notifications-center.js"]')) {
    const script=document.createElement('script');
    script.src='/assets/js/notifications-center.js?v=9.0-executive-3.2-build002';
    document.body.appendChild(script);
  }
})();
