/* =============================================================================
   Aulão "Nova Cartilha do ENEM" - Profa. Taci × Academy Cards
   -----------------------------------------------------------------------------
   Progressive enhancement. O formulário é um POST nativo para o Zoho e funciona
   sem este arquivo; aqui só acrescentamos máscara, validação inline e captura
   de atribuição.

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
    ["ttclid", "ttclid"],
    ["wbraid", "wbraid"],
    ["gbraid", "gbraid"]
  ].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    var val = params.get(pair[1]);
    if (el && val) el.value = val.slice(0, 255);
  });

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

  function maskFone(digits) {
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
    fone.value = maskFone(digits);
    if (atEnd) {
      var end = fone.value.length;
      try { fone.setSelectionRange(end, end); } catch (e) { /* input type=tel */ }
    }
    if (fone.getAttribute("aria-invalid")) validateFone();
  });

  function validateFone() {
    var d = fone.value.replace(/\D/g, "");
    var msg = "";
    if (!d) {
      msg = "Por favor, preencha seu WhatsApp.";
    } else if (d.length < 10) {
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

  /* --- 6. Envio ------------------------------------------------------------ */

  var btn = document.getElementById("submitBtn");
  var btnLabel = document.getElementById("submitLabel");
  var enviando = false;

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

    alertBox.textContent = "";
    enviando = true;
    btnLabel.textContent = "Enviando…";
    btn.classList.add("is-busy");
    // Desabilitar fora do handler para não interferir no envio nativo.
    window.setTimeout(function () { btn.disabled = true; }, 0);
  });
})();
