import { SUPPORT_EMAIL } from "./parentalApprovalScope";
import { randomBytes } from "node:crypto";
/**
 * One self-contained page for every email action (password reset, parent approval).
 * Fixed markup only: token/context are never interpolated into HTML; fetched text is set via textContent.
 * No RootLayout, Analytics or external resources. Decisions always need an explicit POST from a click.
 */
export function emailActionDocument() {
  const nonce = randomBytes(18).toString("base64");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Secure link</title>
<script nonce="${nonce}">
(()=>{let token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
addEventListener('DOMContentLoaded',async()=>{
 const $=id=>document.getElementById(id),status=$('status'),heading=$('heading');
 const post=async(path,body)=>{const r=await fetch(path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Please try again.');return data;};
 const done=(text)=>{token='';status.textContent=text;for(const id of ['reset','parent','renew'])$(id).hidden=true;};
 if(!/^[A-Za-z0-9_-]{43}$/.test(token)){status.textContent='Reopen the link from your email, or request a new link.';$('resetLinks').hidden=false;return;}
 let details;
 try{details=await post('/api/account-actions/details',{token});}catch{status.textContent='This link is invalid or expired. Please request a new one.';token='';$('resetLinks').hidden=false;return;}
 if(details.purpose==='password-reset'){
  heading.textContent=document.title='Reset your password';status.textContent='Use at least 12 characters and at most 72 UTF-8 bytes.';$('reset').hidden=false;$('resetLinks').hidden=false;
  const form=$('reset'),button=$('submit');
  form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;const password=$('password').value,confirm=$('confirm').value;
  if(password!==confirm){status.textContent='Passwords do not match.';button.disabled=false;return;}
  try{const result=await post('/api/account-actions/password-reset',{token,password});token='';form.reset();form.hidden=true;status.textContent=result.message;}
  catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
  return;
 }
 heading.textContent=document.title='Parent or guardian approval';
 if(details.state!=='valid'){
  status.textContent=details.state==='decided'?'This link has already been used, or a decision has already been recorded. Nothing has changed.':details.state==='replaced'?'A newer email has replaced this link.':'This link has expired. Nothing has changed.';
  if(details.renewable){$('renew').hidden=false;$('renewButton').addEventListener('click',async()=>{$('renewButton').disabled=true;try{done((await post('/api/account-actions/renewal',{token})).message);}catch(error){status.textContent=error.message;$('renewButton').disabled=false;}});}
  else{$('help').hidden=false;}
  return;
 }
 const panel=$('parent'),body=panel.querySelector('.explanation');
 for(const text of details.explanation.text.split('\\n\\n')){const p=document.createElement('p');p.textContent=text;body.append(p);}
 for(const el of panel.querySelectorAll('.child'))el.textContent=details.child;
 status.textContent='Please read this, then choose Approve or Decline.';
 $('declarationText').textContent=details.declaration.text;
 panel.hidden=false;
 const decide=async(decision)=>{const box=$('declaration');
  if(!box.checked){status.textContent='Please tick the box to confirm before continuing.';box.focus();return;}
  for(const b of panel.querySelectorAll('button'))b.disabled=true;
  try{done((await post('/api/account-actions/parental-approval',{token,decision,declaration:true})).message);}
  catch(error){status.textContent=error.message;for(const b of panel.querySelectorAll('button'))b.disabled=false;}};
 $('approve').addEventListener('click',()=>decide('approve'));$('decline').addEventListener('click',()=>decide('decline'));
});})();
</script><style nonce="${nonce}">body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#172033;margin:0;padding:20px;font-size:17px}main{max-width:480px;margin:4vh auto}h1{font-size:1.5rem;line-height:1.25}label{display:block;margin:16px 0}input[type=password]{box-sizing:border-box;display:block;font:inherit;padding:12px;width:100%;margin-top:6px}button{box-sizing:border-box;display:block;font:inherit;font-weight:600;min-height:48px;padding:12px;width:100%;margin-top:12px;border-radius:10px;border:1px solid #2347a0;background:#2347a0;color:#fff}button.secondary{background:#fff;color:#2347a0}button:disabled{opacity:.6}a{color:#2347a0}p{line-height:1.55}.check{display:flex;gap:12px;align-items:flex-start;line-height:1.45}.check input{width:24px;height:24px;flex:none;margin:0}.explanation{border-left:3px solid #c7d2fe;padding-left:14px}</style></head><body><main><h1 id="heading">Secure link</h1><p id="status" role="status">Checking your link…</p>
<form id="reset" hidden><label>New password<input id="password" type="password" autocomplete="new-password" required></label><label>Confirm password<input id="confirm" type="password" autocomplete="new-password" required></label><button id="submit" type="submit">Change password</button></form>
<section id="parent" hidden><p><strong class="child"></strong> has asked for your approval to take part in Group Learning.</p><div class="explanation"></div><label class="check"><input id="declaration" type="checkbox"><span id="declarationText"></span></label><button id="approve" type="button">Approve</button><button id="decline" class="secondary" type="button">Decline</button><p>Questions? Reply to the email we sent you, or write to ${SUPPORT_EMAIL}.</p></section>
<div id="renew" hidden><button id="renewButton" type="button">Email me a new link</button></div>
<p id="help" hidden>If you need help, reply to the email we sent you.</p>
<p id="resetLinks" hidden><a href="/login">Sign in</a> · <a href="/login/forgot-password">Request a new link</a></p><noscript>JavaScript is required to use this secure email link.</noscript></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` } });
}
