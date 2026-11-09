/* =============================================================================
   Aulão de demonstração: comportamentos só de interface.
   -----------------------------------------------------------------------------
   Nada aqui toca no formulário nem nos campos enviados ao Zoho: isso é todo do
   main.js. Este arquivo cuida de
     1. contagem regressiva até 16/11/2026, 18h (Brasília);
     2. os flashcards de dúvidas que viram;
     3. a barra fixa do celular e os botões que levam ao formulário.
   Serve às duas páginas: cada bloco sai cedo se o elemento não existir.
   ========================================================================== */

(function () {
  "use strict";

  /* --- 1. Contagem regressiva ---------------------------------------------- */

  var INICIO = Date.parse("2026-11-16T18:00:00-03:00");
  var FIM_APROX = INICIO + 90 * 60 * 1000; // mesmo horário do convite de agenda
  var counters = document.querySelectorAll("[data-countdown]");

  function diaSP(ms) {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date(ms));
    } catch (e) { return ""; }
  }

  function textoContagem(agora) {
    var falta = INICIO - agora;
    if (agora >= FIM_APROX) return "";
    if (falta <= 0) return "Acontecendo agora";
    var horas = Math.floor(falta / 3600000);
    if (horas < 1) return "Começa em " + Math.max(1, Math.ceil(falta / 60000)) + " min";
    if (diaSP(agora) === diaSP(INICIO)) return "É hoje! Começa em " + horas + "h";
    var dias = Math.floor(falta / 86400000);
    if (dias < 1) return "É amanhã, às 18h";
    if (dias === 1) return "Falta 1 dia";
    return "Faltam " + dias + " dias";
  }

  function atualizarContagem() {
    var t = textoContagem(Date.now());
    for (var i = 0; i < counters.length; i++) counters[i].textContent = t;
  }

  if (counters.length) {
    atualizarContagem();
    window.setInterval(atualizarContagem, 30000);
  }

  /* --- 2. Flashcards que viram --------------------------------------------- */

  var flips = document.querySelectorAll(".flip");

  function virar(flip, aberto) {
    var frente = flip.querySelector(".flip__front");
    var voltar = flip.querySelector(".flip__again");
    flip.classList.toggle("is-flipped", aberto);
    frente.setAttribute("aria-expanded", aberto ? "true" : "false");
    // O foco acompanha a face visível; espera a face trocar de visibility.
    window.setTimeout(function () {
      (aberto ? voltar : frente).focus({ preventScroll: true });
    }, 320);
  }

  Array.prototype.forEach.call(flips, function (flip) {
    var frente = flip.querySelector(".flip__front");
    var voltar = flip.querySelector(".flip__again");
    if (!frente || !voltar) return;
    frente.addEventListener("click", function () { virar(flip, true); });
    voltar.addEventListener("click", function () { virar(flip, false); });
  });

  /* --- 2b. Copiar o link da sala (/obrigado) ------------------------------- */

  Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
    var label = btn.querySelector("[data-copy-label]");
    var original = label ? label.textContent : "";

    function feito(ok) {
      if (!label) return;
      label.textContent = ok ? "Link copiado!" : "Copie o link acima";
      btn.classList.toggle("is-done", ok);
      window.setTimeout(function () {
        label.textContent = original;
        btn.classList.remove("is-done");
      }, 2200);
    }

    btn.addEventListener("click", function () {
      var texto = btn.getAttribute("data-copy");
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(texto).then(function () { feito(true); }, function () { feito(false); });
        return;
      }
      // Navegadores sem a API de área de transferência (ou fora de HTTPS).
      try {
        var tmp = document.createElement("textarea");
        tmp.value = texto;
        tmp.setAttribute("readonly", "");
        tmp.style.position = "fixed";
        tmp.style.opacity = "0";
        document.body.appendChild(tmp);
        tmp.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(tmp);
        feito(!!ok);
      } catch (e) { feito(false); }
    });
  });

  /* --- 3. Ir ao formulário + barra fixa do celular ------------------------- */

  var deck = document.getElementById("inscricao");
  var form = document.getElementById("formInscricao");
  if (!deck || !form) return;

  // Leva ao formulário e já foca o primeiro campo vazio: no celular o teclado
  // abre direto, um toque a menos até a inscrição.
  function primeiroCampoVazio() {
    var ids = ["Last_Name", "Email", "Mobile"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && !el.value) return el;
    }
    return document.getElementById("submitBtn");
  }

  var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  Array.prototype.forEach.call(document.querySelectorAll("[data-goto-form]"), function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      deck.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
      var alvo = primeiroCampoVazio();
      window.setTimeout(function () {
        if (alvo) alvo.focus({ preventScroll: true });
      }, reduz ? 0 : 550);
    });
  });

  var dock = document.getElementById("dock");
  var fechamento = document.querySelector(".closer__card");
  if (!dock || !("IntersectionObserver" in window)) return;

  document.body.classList.add("has-dock");

  var passouDoForm = false;
  var fechamentoVisivel = false;
  var digitando = false;

  function atualizarDock() {
    dock.classList.toggle("is-on", passouDoForm && !fechamentoVisivel && !digitando);
  }

  // A barra só aparece depois que o formulário saiu por cima da tela.
  new IntersectionObserver(function (entries) {
    var e = entries[0];
    passouDoForm = !e.isIntersecting && e.boundingClientRect.top < 0;
    atualizarDock();
  }).observe(deck);

  if (fechamento) {
    new IntersectionObserver(function (entries) {
      fechamentoVisivel = entries[0].isIntersecting;
      atualizarDock();
    }).observe(fechamento);
  }

  // Com o teclado aberto, a barra só atrapalha.
  form.addEventListener("focusin", function () { digitando = true; atualizarDock(); });
  form.addEventListener("focusout", function () { digitando = false; atualizarDock(); });
})();
