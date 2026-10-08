let remoteNoticeTimer,remoteNoticeRemaining=0,remoteNoticeStarted=0;
const remoteNotice=document.getElementById('notice');
remoteNotice.setAttribute('role','status');remoteNotice.setAttribute('aria-live','polite');remoteNotice.setAttribute('aria-atomic','true');remoteNotice.hidden=true;
function dismissRemoteNotice(){clearTimeout(remoteNoticeTimer);remoteNotice.hidden=true;remoteNotice.replaceChildren();}
function pauseRemoteNotice(){clearTimeout(remoteNoticeTimer);remoteNoticeRemaining=Math.max(0,remoteNoticeRemaining-(Date.now()-remoteNoticeStarted));}
function resumeRemoteNotice(){clearTimeout(remoteNoticeTimer);if(remoteNoticeRemaining>0){remoteNoticeStarted=Date.now();remoteNoticeTimer=setTimeout(dismissRemoteNotice,remoteNoticeRemaining);}}
function showRemoteNotice(message,kind='success'){
 const text=String(message||'').trim();if(!text)return;
 if(/^Please sign in[.!]?$/i.test(text))return;
 clearTimeout(remoteNoticeTimer);remoteNotice.replaceChildren();remoteNotice.dataset.kind=kind;remoteNotice.setAttribute('role',kind==='error'?'alert':'status');remoteNotice.setAttribute('aria-live',kind==='error'?'assertive':'polite');
 const content=document.createElement('span');content.className='notice-message';content.textContent=text;
 const close=document.createElement('button');close.type='button';close.className='notice-close';close.textContent='×';close.setAttribute('aria-label',document.documentElement.lang==='ar'?'إغلاق التنبيه':'Dismiss notification');close.onclick=dismissRemoteNotice;
 remoteNotice.append(content,close);remoteNotice.hidden=false;remoteNoticeRemaining=kind==='success'?4500:kind==='warning'?8000:12000;remoteNoticeStarted=Date.now();resumeRemoteNotice();
}
remoteNotice.addEventListener('mouseenter',pauseRemoteNotice);remoteNotice.addEventListener('mouseleave',resumeRemoteNotice);remoteNotice.addEventListener('focusin',pauseRemoteNotice);remoteNotice.addEventListener('focusout',resumeRemoteNotice);
