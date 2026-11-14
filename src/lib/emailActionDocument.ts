import { randomBytes } from "node:crypto";
/** Fixed markup only: token/context never interpolated into HTML. No RootLayout or external resources. */
export function emailActionDocument() {
  const nonce = randomBytes(18).toString("base64");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Reset your password</title>
<script nonce="${nonce}">
(()=>{let token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
addEventListener('DOMContentLoaded',async()=>{
 const status=document.getElementById('status'),form=document.getElementById('reset'),button=document.getElementById('submit');
 const post=async(path,body)=>{const r=await fetch(path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Please try again.');return data;};
 if(!/^[A-Za-z0-9_-]{43}$/.test(token)){status.textContent='Reopen the link from your email, or request a new link.';return;}
 try{await post('/api/account-actions/details',{token});status.textContent='Use at least 12 characters and at most 72 UTF-8 bytes.';form.hidden=false;}catch{status.textContent='This link is invalid or expired. Please request a new one.';token='';return;}
 form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;const password=document.getElementById('password').value,confirm=document.getElementById('confirm').value;
 if(password!==confirm){status.textContent='Passwords do not match.';button.disabled=false;return;}
 try{const result=await post('/api/account-actions/password-reset',{token,password});token='';form.reset();form.hidden=true;status.textContent=result.message;}
 catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
});})();
</script><style nonce="${nonce}">body{font-family:system-ui,sans-serif;background:#f8fafc;color:#172033;margin:0;padding:24px}main{max-width:420px;margin:8vh auto}label{display:block;margin:16px 0}input,button{box-sizing:border-box;display:block;font:inherit;padding:12px;width:100%;margin-top:6px}a{color:#2347a0}p{line-height:1.5}</style></head><body><main><h1>Reset your password</h1><p id="status" role="status">Checking your link…</p><form id="reset" hidden><label>New password<input id="password" type="password" autocomplete="new-password" required></label><label>Confirm password<input id="confirm" type="password" autocomplete="new-password" required></label><button id="submit" type="submit">Change password</button></form><p><a href="/login">Sign in</a> · <a href="/login/forgot-password">Request a new link</a></p><noscript>JavaScript is required to use this secure email link.</noscript></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` } });
}
