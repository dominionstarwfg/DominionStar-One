document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>window.presenterBridge.command(button.dataset.command)));
