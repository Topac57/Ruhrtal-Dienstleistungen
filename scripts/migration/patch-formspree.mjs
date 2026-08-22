/**
 * Baut die Formspree-Anbindung in das Kontaktformular ein.
 * Der Endpoint kommt NICHT aus dem Quelltext, sondern wird beim Build aus der
 * Umgebungsvariablen FORMSPREE_FORM_ID eingesetzt (scripts/build.mjs).
 * Ohne konfigurierten Endpoint sendet das Formular nicht und zeigt statt eines
 * stillen Fehlers einen Hinweis mit Telefonnummer und E-Mail-Adresse.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../index.html', import.meta.url);
let html = readFileSync(FILE, 'utf8');
const log = [];

function replaceOnce(label, find, repl) {
  const parts = html.split(find);
  if (parts.length !== 2) throw new Error(`[${label}] erwartete 1 Treffer, gefunden: ${parts.length - 1}`);
  html = parts[0] + repl + parts[1];
  log.push(`ok  ${label}`);
}

/* 1. Endpoint-Platzhalter in den Head. Der Build ersetzt ihn; bleibt er stehen,
      gilt das Formular als nicht konfiguriert. */
replaceOnce('formspree: Endpoint-Platzhalter im Head',
`<script src="/vendor/react.production.min.js"></script>`,
`<script>window.__RT_FORMSPREE__ = "__FORMSPREE_ENDPOINT__";</script>
<script src="/vendor/react.production.min.js"></script>`);

/* 2. Versteckte Felder: Betreff fuer die Mail, Honeypot gegen Bots. */
replaceOnce('formspree: hidden fields im Formular',
`            <h2 style="font-size:clamp(21px,2.2vw,27px);font-weight:800;letter-spacing:-.02em;margin-bottom:6px">Anfrage senden</h2>`,
`            <input type="hidden" name="_subject" value="Website-Anfrage über ruhrtal-dienstleistungen.de">
            <input type="text" name="_gotcha" tabIndex="-1" autoComplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
            <h2 style="font-size:clamp(21px,2.2vw,27px);font-weight:800;letter-spacing:-.02em;margin-bottom:6px">Anfrage senden</h2>`);

/* 3. Fehlerhinweis ueber dem Absende-Button, im vorhandenen Stil. */
replaceOnce('formspree: Fehlerhinweis im Formular',
`            <button type="submit" style="margin-top:26px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:11px;background:#4C9C3F;color:#fff;border:0;padding:18px 28px;border-radius:999px;font-weight:700;font-size:17px;box-shadow:0 14px 32px rgba(76,156,63,.3);transition:background .25s,transform .25s" style-hover="background:#3E8834;transform:translateY(-2px)">
              Anfrage absenden`,
`            <sc-if value="{{ formErr }}" hint-placeholder-val="{{ false }}">
              <div role="alert" style="margin-top:20px;padding:16px 18px;border:1px solid #E6C9C4;background:#FCF4F3;border-radius:14px;font-size:14.5px;color:#8A3B2E">{{ formErrText }}</div>
            </sc-if>
            <button type="submit" disabled="{{ sending }}" style="margin-top:26px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:11px;background:#4C9C3F;color:#fff;border:0;padding:18px 28px;border-radius:999px;font-weight:700;font-size:17px;box-shadow:0 14px 32px rgba(76,156,63,.3);transition:background .25s,transform .25s;opacity:{{ sendOpacity }}" style-hover="background:#3E8834;transform:translateY(-2px)">
              {{ sendLabel }}`);

/* 4. State um Sende- und Fehlerzustand erweitern. */
replaceOnce('formspree: State erweitert',
`    this.state = { page:'start', svc:'glas', menu:false, wide:true, pair:0, scrolled:false, sent:false, sentName:'' };`,
`    this.state = { page:'start', svc:'glas', menu:false, wide:true, pair:0, scrolled:false, sent:false, sentName:'', sending:false, formErr:'' };`);

/* 5. onSubmit: tatsaechlich an Formspree senden. */
replaceOnce('formspree: onSubmit sendet',
`      onSubmit: e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const n = (fd.get('name') || '').toString().trim();
        this.setState({ sent:true, sentName:n }, () => window.scrollTo({ top: Math.max(0, window.scrollY - 120), behavior:'smooth' }));
      }`,
`      sending: st.sending,
      sendLabel: st.sending ? 'Wird gesendet …' : 'Anfrage absenden',
      sendOpacity: st.sending ? '.65' : '1',
      formErr: !!st.formErr,
      formErrText: st.formErr,
      onSubmit: e => {
        e.preventDefault();
        if (this.state.sending) return;
        const form = e.target;
        const fd = new FormData(form);
        const n = (fd.get('name') || '').toString().trim();
        const ep = this.formEndpoint();
        if (!ep) {
          this.setState({ formErr: 'Das Formular ist noch nicht freigeschaltet. Bitte rufen Sie uns an unter 0176 47883327 oder schreiben Sie an info@ruhrtal-dienstleistungen.de.' });
          return;
        }
        this.setState({ sending:true, formErr:'' });
        fetch(ep, { method:'POST', body:fd, headers:{ Accept:'application/json' } })
          .then(res => res.json().catch(() => ({})).then(data => {
            if (res.ok) return;
            const msg = (data && data.errors || []).map(x => x.message).join(', ');
            throw new Error(msg || 'Die Anfrage konnte nicht gesendet werden.');
          }))
          .then(() => this.setState({ sent:true, sentName:n, sending:false },
            () => window.scrollTo({ top: Math.max(0, window.scrollY - 120), behavior:'smooth' })))
          .catch(err => this.setState({ sending:false,
            formErr: (err && err.message ? err.message : 'Die Anfrage konnte nicht gesendet werden.') + ' Bitte versuchen Sie es erneut oder rufen Sie an: 0176 47883327.' }));
      }`);

/* 6. Endpoint-Aufloesung: akzeptiert volle URL oder blosse Form-ID. */
replaceOnce('formspree: formEndpoint()',
`  seoBase(){ return 'https://www.ruhrtal-dienstleistungen.de'; }`,
`  // Beim Build aus FORMSPREE_FORM_ID gesetzt. Akzeptiert die vollstaendige
  // Endpoint-URL ebenso wie die blosse Form-ID aus dem Formspree-Dashboard.
  formEndpoint(){
    const v = (typeof window !== 'undefined' && window.__RT_FORMSPREE__ || '').trim();
    if (!v || v.indexOf('__') === 0) return '';
    return v.indexOf('http') === 0 ? v : 'https://formspree.io/f/' + v;
  }

  seoBase(){ return 'https://www.ruhrtal-dienstleistungen.de'; }`);

/* 7. "Weitere Anfrage stellen" muss den Fehlerzustand mit zuruecksetzen. */
replaceOnce('formspree: resetForm loescht Fehler',
`      resetForm: () => this.setState({ sent:false, sentName:'' }),`,
`      resetForm: () => this.setState({ sent:false, sentName:'', formErr:'', sending:false }),`);

writeFileSync(FILE, html);
console.log(log.join('\n'));
console.log('\nFormspree-Anbindung eingebaut.');
