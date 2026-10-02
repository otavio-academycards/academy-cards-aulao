/* =============================================================================
   Aulão "Nova Cartilha do ENEM" - Profa. Taci × Academy Cards
   -----------------------------------------------------------------------------
   O formulário é um POST nativo para o Webform de Conversões do Zoho
   (7253906000002963033), no mesmo padrão da LP. Este arquivo acrescenta
   máscara, validação inline, captura de atribuição, a derivação de
   Telefone/Celular e os campos gerados no envio (Name, Data/Hora da
   Conversão e ID da submissão), obrigatórios no Webform.

   IMPORTANTE: validamos FORMATO e plausibilidade. Não temos como verificar se
   um e-mail ou um número existe de fato - e nenhum texto da página afirma isso.
   ========================================================================== */

(function () {
  "use strict";

  var form = document.getElementById("formInscricao");
  if (!form) return;

  /* --- 1. Atribuição -------------------------------------------------------
     Copia UTMs e click IDs da query string para os campos ocultos do Zoho.   */

  var params = new URLSearchParams(window.location.search);

  [
    ["utm_source", "utm_source"],
    ["utm_medium", "utm_medium"],
    ["utm_campaign", "utm_campaign"],
    ["utm_content", "utm_content"],
    ["utm_term", "utm_term"],
    ["fbclid", "fbclid"],
    ["gclid", "gclid"],
    ["ttclid", "ttclid"],
    ["wbraid", "wbraid"],
    ["gbraid", "gbraid"]
  ].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    var val = params.get(pair[1]);
    if (el && val) el.value = val.slice(0, 255);
  });

  // gclid também no zc_gad, como antes (integração Google Ads do Zoho).
  var gad = document.getElementById("zc_gad");
  if (gad && !gad.value && params.get("gclid")) gad.value = params.get("gclid").slice(0, 255);

  var origem = document.getElementById("paginaOrigem");
  if (origem) {
    // Sem a query string: os parâmetros já vão nos campos próprios.
    origem.value = (window.location.origin + window.location.pathname).slice(0, 255);
  }

  /* --- 2. Utilidades de campo --------------------------------------------- */

  var alertBox = document.getElementById("formAlert");

  function setError(input, msgEl, message) {
    if (message) {
      input.setAttribute("aria-invalid", "true");
      msgEl.textContent = message;
    } else {
      input.removeAttribute("aria-invalid");
      msgEl.textContent = "";
    }
    return !message;
  }

  /* --- 3. Nome ------------------------------------------------------------- */

  var nome = document.getElementById("Last_Name");
  var nomeMsg = document.getElementById("err-nome");

  function validateNome(silent) {
    var v = nome.value.trim().replace(/\s+/g, " ");
    var msg = "";
    if (!v) msg = "Por favor, preencha seu nome.";
    else if (v.length < 2) msg = "Nome muito curto.";
    else if (!/[A-Za-zÀ-ÿ]/.test(v)) msg = "Digite seu nome com letras.";
    if (silent && msg) return false;
    return setError(nome, nomeMsg, msg);
  }

  nome.addEventListener("blur", function () {
    nome.value = nome.value.trim().replace(/\s+/g, " ");
    if (nome.value) validateNome();
  });
  nome.addEventListener("input", function () {
    if (nome.getAttribute("aria-invalid")) validateNome();
  });

  /* --- 4. E-mail ----------------------------------------------------------
     Formato + sugestão de correção de domínio. A sugestão NUNCA bloqueia o
     envio: é ajuda, não veredito.                                            */

  var email = document.getElementById("Email");
  var emailMsg = document.getElementById("err-email");
  var emailSug = document.getElementById("sug-email");

  // Provedores mais usados no Brasil.
  var DOMINIOS = [
    "gmail.com", "hotmail.com", "outlook.com", "outlook.com.br",
    "hotmail.com.br", "yahoo.com", "yahoo.com.br", "icloud.com",
    "live.com", "bol.com.br", "uol.com.br", "terra.com.br",
    "globo.com", "me.com", "protonmail.com"
  ];

  // Erros de TLD que a distância de edição sozinha não pega bem.
  var TLD_FIX = {
    "gmail.con": "gmail.com", "gmail.co": "gmail.com", "gmail.cm": "gmail.com",
    "gmail.comm": "gmail.com", "gmail.com.br": "gmail.com",
    "hotmail.con": "hotmail.com", "hotmail.co": "hotmail.com",
    "outlook.con": "outlook.com", "yahoo.con": "yahoo.com.br",
    "icloud.con": "icloud.com"
  };

  /* Damerau-Levenshtein (alinhamento restrito). Conta transposição como UMA
     edição - essencial aqui: "gmial" por "gmail" é o erro de digitação mais
     comum, e com Levenshtein puro ele custaria 2 e passaria despercebido. */
  function distancia(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        var custo = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
        if (i > 1 && j > 1 &&
            a.charAt(i - 1) === b.charAt(j - 2) &&
            a.charAt(i - 2) === b.charAt(j - 1)) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }

  function suggestDomain(dominio) {
    if (TLD_FIX[dominio]) return TLD_FIX[dominio];
    if (DOMINIOS.indexOf(dominio) !== -1) return null;
    var best = null, bestD = 99;
    DOMINIOS.forEach(function (d) {
      var dist = distancia(dominio, d);
      if (dist < bestD) { bestD = dist; best = d; }
    });
    // Tolerância proporcional: domínios curtos aceitam 1 erro, longos aceitam 2.
    var limite = best && best.length >= 10 ? 2 : 1;
    return bestD > 0 && bestD <= limite ? best : null;
  }

  function clearSuggestion() { emailSug.textContent = ""; }

  function showSuggestion(corrigido) {
    clearSuggestion();
    var span = document.createElement("span");
    span.textContent = "Você quis dizer ";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = corrigido;
    btn.addEventListener("click", function () {
      email.value = corrigido;
      clearSuggestion();
      validateEmail();
      email.focus();
    });
    emailSug.appendChild(span);
    emailSug.appendChild(btn);
    emailSug.appendChild(document.createTextNode(" ?"));
  }

  // Formato deliberadamente conservador: um @, domínio com ponto, TLD >= 2.
  var RE_EMAIL = /^[^\s@,;:"'()[\]<>\\]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

  function validateEmail() {
    var v = email.value.trim();
    var msg = "";
    if (!v) msg = "Por favor, preencha seu e-mail.";
    else if (!RE_EMAIL.test(v)) msg = "Esse e-mail parece incompleto. Confira o formato.";

    var ok = setError(email, emailMsg, msg);
    if (!ok) { clearSuggestion(); return false; }

    var dominio = v.split("@").pop().toLowerCase();
    var sug = suggestDomain(dominio);
    if (sug) showSuggestion(v.split("@")[0] + "@" + sug);
    else clearSuggestion();
    return true;
  }

  email.addEventListener("blur", function () {
    email.value = email.value.trim();
    if (email.value) validateEmail();
  });
  email.addEventListener("input", function () {
    clearSuggestion();
    if (email.getAttribute("aria-invalid")) {
      setError(email, emailMsg, "");
    }
  });

  /* --- 5. WhatsApp --------------------------------------------------------- */

  var fone = document.getElementById("Mobile");
  var foneMsg = document.getElementById("err-fone");
  var phoneEl = document.getElementById("phoneOriginal");
  var mobileEl = document.getElementById("mobileNormalizado");

  // O campo visível não tem name: o número vai normalizado nos ocultos
  // COBJ2CF4 (Celular_Informado) e COBJ2CF22 (Telefone_Informado).
  fone.removeAttribute("name");

  var DDDS = [
    11,12,13,14,15,16,17,18,19,
    21,22,24,27,28,
    31,32,33,34,35,37,38,
    41,42,43,44,45,46,47,48,49,
    51,53,54,55,
    61,62,63,64,65,66,67,68,69,
    71,73,74,75,77,79,
    81,82,83,84,85,86,87,88,89,
    91,92,93,94,95,96,97,98,99
  ];

  /* Telefone para o Zoho. Mesma regra da LP principal (lp/TELEFONE-BR.md em
     academy-cards-sites): do número digitado derivam DOIS valores.
       Phone  -> número informado em +55/E.164, sem tocar no 9
       Mobile -> WhatsApp ID, sem o 9 fora dos DDDs abaixo
     No fluxo Cadence -> WhatsApp -> Zoho Desk o WhatsApp ID nem sempre tem o
     nono dígito, e o Desk criava um segundo Contact quando não batia.
       (31) 99695-4497 -> Phone +5531996954497 | Mobile +553196954497
       (11) 98805-5068 -> Phone +5511988055068 | Mobile +5511988055068
     Se a lista mudar, atualizar junto todas as cópias da regra.            */

  // DDDs em que o WhatsApp ID mantém o nono dígito.
  var DDD_WHATSAPP_COM_9 = [
    "11", "12", "13", "14", "15", "16", "17", "18", "19",
    "21", "22", "24",
    "27", "28"
  ];

  function temCodigoEstrangeiro(value) {
    var raw = String(value || "").trim();
    return raw.charAt(0) === "+" && raw.replace(/\D/g, "").slice(0, 2) !== "55";
  }

  // Dígitos nacionais (DDD + 8 ou 9), sem o código do país; "" se inválido.
  // Precisa da string original: é o "+" que distingue +1 212... de um DDD 12.
  function brNationalDigits(value) {
    var raw = String(value || "").trim();
    var digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    var national;
    if (raw.charAt(0) === "+") {
      // "+" explícito: só +55 é aceito.
      national = digits.slice(0, 2) === "55" ? digits.slice(2) : "";
    } else if ((digits.length === 12 || digits.length === 13) && digits.slice(0, 2) === "55") {
      // 55 sem o "+". Só com 12/13 dígitos: o DDD 55 existe.
      national = digits.slice(2);
    } else {
      national = digits;
    }
    return (national.length === 10 || national.length === 11) ? national : "";
  }

  function toBrazilE164(value) {
    var national = brNationalDigits(value);
    return national ? "+55" + national : "";
  }

  function toWhatsAppNumber(value) {
    var national = brNationalDigits(value);
    if (!national) return "";
    var ddd = national.slice(0, 2);
    var numero = national.slice(2);
    if (numero.length === 9 && numero.charAt(0) === "9" &&
        DDD_WHATSAPP_COM_9.indexOf(ddd) === -1) {
      numero = numero.slice(1);
    }
    return "+55" + ddd + numero;
  }

  function maskFone(digits) {
    // Descartar o 55 ANTES do corte em 11: sem isso, colar +5531996954497
    // vira (55) 31996-9544 e o número se perde.
    if ((digits.length === 12 || digits.length === 13) && digits.slice(0, 2) === "55") {
      digits = digits.slice(2);
    }
    var d = digits.slice(0, 11);
    if (d.length <= 2) return d.length ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  fone.addEventListener("input", function () {
    var before = fone.value;
    var digits = before.replace(/\D/g, "");
    var atEnd = fone.selectionStart === before.length;
    // Código de país estrangeiro: não reformatar como brasileiro; a
    // validação reprova.
    if (temCodigoEstrangeiro(before)) {
      if (fone.getAttribute("aria-invalid")) validateFone();
      return;
    }
    fone.value = maskFone(digits);
    if (atEnd) {
      var end = fone.value.length;
      try { fone.setSelectionRange(end, end); } catch (e) { /* input type=tel */ }
    }
    if (fone.getAttribute("aria-invalid")) validateFone();
  });

  function validateFone() {
    // Mesma fonte de verdade da normalização enviada ao Zoho.
    var d = brNationalDigits(fone.value);
    var msg = "";
    if (!fone.value.replace(/\D/g, "")) {
      msg = "Por favor, preencha seu WhatsApp.";
    } else if (temCodigoEstrangeiro(fone.value)) {
      msg = "Informe um número do Brasil, com DDD.";
    } else if (!d) {
      msg = "Número incompleto. Inclua o DDD e os 9 dígitos.";
    } else if (DDDS.indexOf(parseInt(d.slice(0, 2), 10)) === -1) {
      msg = "DDD inválido. Confira os dois primeiros dígitos.";
    } else if (d.length === 11 && d.charAt(2) !== "9") {
      msg = "Celular com 11 dígitos precisa começar com 9 depois do DDD.";
    } else if (d.length === 10 && "6789".indexOf(d.charAt(2)) !== -1) {
      msg = "Parece faltar o 9 no começo do número.";
    }
    return setError(fone, foneMsg, msg);
  }

  fone.addEventListener("blur", function () { if (fone.value) validateFone(); });

  /* --- 6. Campos gerados no envio (Conversões) -------------------------------
     Mesmo padrão da LP. Data/Hora_da_Conversao no formato do HTML gerado pelo
     Zoho: data DD/MM/YYYY + hora 01..12, minuto 00..59 e AM/PM, relógio de
     America/Sao_Paulo (gravado como -03:00, sem segundos).                  */

  function saoPauloParts(d) {
    var parts = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h12"
    }).formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
    var h24 = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23"
    }).format(d);
    return {
      dd: parts.day, mm: parts.month, yyyy: parts.year,
      hh12: parts.hour, min: parts.minute, ss: parts.second,
      ampm: String(parts.dayPeriod || "").toUpperCase(),
      hh24: h24
    };
  }

  function newSubmissionId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (e) { /* segue para o fallback */ }
    return "aulao-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  var SUBMISSION_FIELD_IDS = ["convName", "dhData", "dhHora", "dhMinuto", "dhAmPm", "idExterno"];

  // Lança erro se algum campo obrigatório da submissão não existir ou ficar
  // vazio. A mensagem cita só o id do campo, nunca valores digitados.
  function fillSubmissionFields() {
    var els = {};
    SUBMISSION_FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) throw new Error("Campo de submissão ausente: " + id);
      els[id] = el;
    });
    var p = saoPauloParts(new Date());
    els.dhData.value = p.dd + "/" + p.mm + "/" + p.yyyy;
    els.dhHora.value = p.hh12;
    els.dhMinuto.value = p.min;
    els.dhAmPm.value = p.ampm;
    // Name do registro (máx. 120): origem + e-mail + data/hora SP.
    var emailTxt = String(email.value || "").trim().toLowerCase();
    els.convName.value = ("Aulão Taci - " + emailTxt + " - " + p.yyyy + "-" + p.mm + "-" + p.dd +
      " " + p.hh24 + ":" + p.min + ":" + p.ss).slice(0, 120);
    // Um identificador novo por submissão.
    els.idExterno.value = newSubmissionId();

    SUBMISSION_FIELD_IDS.forEach(function (id) {
      if (String(els[id].value || "") === "") throw new Error("Campo de submissão vazio: " + id);
    });
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(els.dhData.value) ||
        !/^\d{1,2}$/.test(els.dhHora.value) ||
        !/^\d{2}$/.test(els.dhMinuto.value) ||
        !/^(AM|PM)$/.test(els.dhAmPm.value)) {
      throw new Error("Data/Hora da submissão inválida");
    }
  }

  /* --- 7. Envio ------------------------------------------------------------ */

  var btn = document.getElementById("submitBtn");
  var btnLabel = document.getElementById("submitLabel");
  var btnLabelOriginal = btnLabel.textContent;
  var enviando = false;

  // Voltar do Zoho/obrigado pelo bfcache restaura a página com o botão
  // travado em "Enviando…". Destrava.
  window.addEventListener("pageshow", function () {
    enviando = false;
    btn.disabled = false;
    btn.classList.remove("is-busy");
    btnLabel.textContent = btnLabelOriginal;
  });

  form.addEventListener("submit", function (e) {
    if (enviando) { e.preventDefault(); return; }

    var okNome = validateNome();
    var okMail = validateEmail();
    var okFone = validateFone();

    if (!(okNome && okMail && okFone)) {
      e.preventDefault();
      alertBox.textContent = "Confira os campos destacados para continuar.";
      var primeiro = form.querySelector('[aria-invalid="true"]');
      if (primeiro) {
        primeiro.focus({ preventScroll: true });
        primeiro.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }

    // Os dois derivam do valor digitado. O campo visível NÃO é sobrescrito:
    // ao voltar pelo bfcache, um reenvio gravaria Phone já sem o nono dígito.
    phoneEl.value = toBrazilE164(fone.value);
    mobileEl.value = toWhatsAppNumber(fone.value);

    try {
      fillSubmissionFields();
    } catch (err) {
      e.preventDefault();
      alertBox.textContent = "Não foi possível enviar agora. Recarregue a página e tente de novo.";
      try { console.error("[inscricao]", err && err.message); } catch (e2) { /* sem console */ }
      return;
    }

    // GTM: submissão local válida. Nome próprio, não lp_form_submit: o
    // container é o da LP principal e as tags dela não devem disparar aqui.
    // Corre contra a navegação do POST nativo; a conversão confiável é o
    // pageview de /obrigado. Sem dados pessoais no payload.
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "aulao_form_submit",
        form_id: "formInscricao",
        form_location: "inscricao"
      });
    } catch (err) { /* tracking nunca bloqueia o envio */ }

    alertBox.textContent = "";
    enviando = true;
    btnLabel.textContent = "Enviando…";
    btn.classList.add("is-busy");
    // Desabilitar fora do handler para não interferir no envio nativo.
    window.setTimeout(function () { btn.disabled = true; }, 0);
  });
})();
