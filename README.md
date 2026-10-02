# Aulão "Nova Cartilha do ENEM", Profa. Taci × Academy Cards

Landing page de evento único, com uma única conversão: inscrição no aulão
gratuito de **08/10/2026, às 20h** (quinta-feira, horário de Brasília).

HTML/CSS/JS estático. Sem build, sem `package.json`, sem dependências em
runtime. Para publicar, suba a pasta inteira.

---

## Estrutura

```
index.html              a landing page
obrigado.html           confirmação (é o returnURL do formulário Zoho)
assets/
  css/styles.css        o sistema visual inteiro
  css/fonts.css         @font-face, GERADO, não editar
  fonts/nunito.woff2    GERADO
  img/                  GERADO
  js/main.js            máscara, validação e captura de UTM
tools/build-assets.py   gera tudo que está marcado como GERADO
identidade-academy/     originais, somente leitura
identidade-taci/        originais, somente leitura
```

`tools/build-assets.py` **lê** das duas pastas de identidade e **escreve** em
`assets/`. Ele nunca modifica, move ou renomeia os originais, e confere isso ao
final de cada execução.

---

## Rodar localmente

```bash
python -m http.server 8777
# abra http://127.0.0.1:8777
```

Abrir `index.html` direto pelo sistema de arquivos também funciona, mas as
fontes self-hosted podem não carregar por causa do CORS. Prefira o servidor.

## Regenerar os assets

Só é necessário ao trocar a foto, os logos ou as fontes.

```bash
python tools/build-assets.py
```

Requer Pillow (`python -m pip install Pillow`) e acesso à rede, apenas para
baixar a Nunito do Google Fonts. Se a rede falhar, o passo das fontes é pulado
e os arquivos já existentes continuam valendo.

---

## Onde mexer no conteúdo

| O que | Onde |
|---|---|
| Data, horário, textos | `index.html` (busque por `08 de outubro`) |
| Data no JSON-LD (Google) | `index.html`, bloco `application/ld+json`, campo `startDate` |
| Cores | `assets/css/styles.css`, bloco `:root` |
| Itens da seção "O que você vai entender" | `index.html`, `<ul class="agenda__list">` |
| Foto do hero | `tools/build-assets.py`, função `build_hero()` |
| Domínio nas metatags OG e no `canonical` | `index.html`, `<head>` |

A página está escrita para o domínio `https://aulao.academycards.com.br`. Se o
endereço final for outro, ajuste `canonical`, `og:url` e `og:image` no `<head>`
do `index.html`, e o `returnURL` do formulário (ver abaixo).

### Bio da professora

Não há nenhuma credencial, número ou informação profissional inventada na
página, os materiais fornecidos não traziam nada disso. A Profa. Taci aparece
pela foto grande no hero e pelo logotipo "Projeto Redação". Se você quiser
acrescentar uma linha de bio real, o lugar natural é dentro do bloco
`<p class="credit">` no `index.html`, onde hoje está "Profa. Taci / quem
ministra o aulão".

---

## Formulário (Zoho CRM)

O formulário tem markup próprio e faz **POST nativo** para
`https://crm.zoho.com/crm/WebToContactForm`, reaproveitando os mesmos `name=`
e tokens ocultos do snippet original do Zoho. O CSS e o JS que vinham no
snippet foram descartados; o script de analytics `wf_anal` foi mantido.

**Funciona sem JavaScript.** Sem JS perdem-se a máscara do telefone, a
validação inline, a captura de UTM e a normalização do telefone (`Mobile` vai
como digitado e `Phone` vazio); o envio em si continua funcionando.

### Campos enviados

Visíveis (3):

| Label na tela | `name` no Zoho |
|---|---|
| Nome | `Last Name`. O Zoho exige esse campo; o nome inteiro vai nele |
| E-mail | `Email` |
| WhatsApp (com DDD) | nenhum com JS (o `main.js` passa o `name="Mobile"` para o oculto); `Mobile` sem JS |

Ocultos e preenchidos automaticamente:

- `Phone` = número informado em +55/E.164, sem tocar no nono dígito
- `Mobile` = WhatsApp ID (ver "Telefone" abaixo)

- `CONTACTCF12` (Origem do Fluxo) = **`Aulão de redação - Taci`**
- `CONTACTCF16` (Origem da oportunidade) = **`Landing Page de Venda`**
- `CONTACTCF10` (Página de Origem) = a URL da página, sem a query string
- `CONTACTCF7/8/9/3/5` = `utm_source` / `utm_medium` / `utm_campaign` /
  `utm_content` / `utm_term`
- `CONTACTCF11` / `CONTACTCF2` / `CONTACTCF4` / `CONTACTCF6` = `fbclid` /
  `ttclid` / `wbraid` / `gbraid`
- `aG9uZXlwb3Q`, honeypot anti-spam do Zoho. **Precisa continuar vazio**; o JS
  nunca encosta nele.

Os dois valores de classificação foram **confirmados com o dono do CRM**:
`Origem do Fluxo = Aulão de redação - Taci` (é também o padrão que o snippet
do Zoho já traz selecionado) e `Origem da oportunidade = Landing Page de Venda`.

### Telefone

Mesma regra da LP principal (`lp/TELEFONE-BR.md` em academy-cards-sites). Do número
digitado derivam dois valores, gravados nos ocultos só no envio; o campo
visível nunca é sobrescrito:

| Digitado | `Phone` | `Mobile` |
|---|---|---|
| `(31) 99695-4497` | `+5531996954497` | `+553196954497` |
| `(11) 98805-5068` | `+5511988055068` | `+5511988055068` |
| `+55 31 99695-4497` (colado) | `+5531996954497` | `+553196954497` |
| `+1 212 555-1234` | reprovado na validação | |

`Mobile` remove o nono dígito fora dos DDDs 11–19, 21, 22, 24, 27 e 28, para
casar com o WhatsApp ID no fluxo Cadence → WhatsApp → Zoho Desk e não duplicar
o Contact. A lista está em `DDD_WHATSAPP_COM_9`, em `assets/js/main.js`; se
mudar, atualizar junto todas as cópias da regra.

O campo `Cupom` (`CONTACTCF1`) existe no Zoho, é opcional e foi deixado de
fora para reduzir fricção.

### Medição (GTM)

`index.html` e `obrigado.html` carregam o container `GTM-5WTS9N2S`, o mesmo
da LP principal. Dois sinais de inscrição:

| Sinal | Quando | Confiabilidade |
|---|---|---|
| `dataLayer` `aulao_form_submit` (`form_id`, `form_location`, sem dados pessoais) | submissão local válida, antes do POST ao Zoho | pode se perder: corre contra a navegação |
| Pageview de `/obrigado` | Zoho aceitou e redirecionou | conversão principal; recarregar conta de novo |

O nome é próprio de propósito: com `lp_form_submit`, as tags da LP principal
disparariam aqui. No GTM, filtre os acionadores do Aulão por
`Page Hostname = aulao.academycards.com.br`, e o `/obrigado` por
`Page Path` começando com `/obrigado` (o arquivo sobe em três chaves).

### Validação, o que ela realmente faz

Validamos **formato e plausibilidade**. Não há como verificar se um e-mail ou
um número existe de fato, e **nenhum texto da página afirma que verificamos**.

- **Nome**, mínimo 2 caracteres, ao menos uma letra.
- **E-mail**, formato, mais uma **sugestão de correção de domínio**:
  `maria@gmial.com` → *"Você quis dizer maria@gmail.com?"*, com um toque para
  corrigir. Usa distância de Damerau-Levenshtein (conta transposição como uma
  edição só; sem isso, `gmial`/`gmail` passaria batido). A sugestão **nunca
  bloqueia o envio**: é ajuda, não veredito.
- **WhatsApp**, máscara automática (aceita colar com `+55`), 10 ou 11 dígitos,
  só números do Brasil, DDD conferido contra a lista de DDDs válidos, e o 9º
  dígito exigido nos celulares.

Optamos por **não** usar campo de "confirme seu e-mail": ele dobra a digitação
num público que chega do Instagram pelo celular e, na prática, não pega o erro
mais comum (a pessoa cola o mesmo valor errado nos dois campos).

---

## Como testar sem sujar o CRM

Um envio real grava um contato de verdade no Zoho. Para exercitar o formulário
sem enviar nada, bloqueie o submit no console do navegador antes de clicar:

```js
document.getElementById('formInscricao')
  .addEventListener('submit', e => e.preventDefault(), true);
```

Vale testar:

- enviar vazio → três erros inline, foco no primeiro campo;
- `maria@gmial.com` → aparece a sugestão e o botão **Corrigir** funciona;
- `(01) 9999-9999` → erro de DDD;
- `(51) 8888-87777` → erro do nono dígito;
- `(31) 99695-4497` → ocultos `Phone = +5531996954497` e `Mobile = +553196954497`;
- `(11) 98805-5068` → `Phone` e `Mobile` **iguais**, `+5511988055068` (é o
  caso que prova que a regra rodou, e não que o 9 foi esquecido);
- colar `+55 31 99695-4497` → a máscara exibe `(31) 99695-4497`;
- colar `+1 212 555-1234` → não reformata e a validação reprova;
- enviar, voltar pelo botão Voltar → campo intacto e botão respondendo;
- abrir com `?utm_source=instagram&utm_medium=bio&fbclid=abc` e inspecionar os
  campos ocultos;
- desligar o JavaScript e conferir que o POST nativo continua de pé.

No envio real, confira o registro **dentro do Zoho**, pelos rótulos
"Telefone" e "Celular": payload certo no Network não basta, porque o Zoho
descarta sem aviso campos que não estão no webform.

Para o teste ponta a ponta de verdade (um envio real), combine antes: ele cria
um contato no CRM e redireciona para `/obrigado`.

---

## Publicação

### O arquivo `obrigado` (sem extensão)

Existe na raiz do projeto uma **cópia de `obrigado.html` chamada apenas
`obrigado`**, sem extensão. Não é lixo: é o arquivo que precisa existir no
bucket com essa chave exata, porque o `returnURL` do Zoho aponta para
`/obrigado`.

> ⚠️ **Se você editar `obrigado.html`, copie por cima do `obrigado` também.**
> São dois arquivos com o mesmo conteúdo. O `deploy.sh` resolve isso sozinho
> (ele copia o `.html` para as duas chaves), mas quem sobe pelo console precisa
> arrastar os dois.

### Caminho de `/obrigado` por hospedagem

A página espera que `obrigado.html` responda em **`/obrigado`**, porque é isso
que está no `returnURL` do Zoho. Dependendo da hospedagem:

- **Vercel / Netlify**, servem `/obrigado` a partir de `obrigado.html`
  automaticamente (clean URLs).
- **Nginx / Apache**, crie o rewrite de `/obrigado` para `/obrigado.html`, ou
  mova o arquivo para `obrigado/index.html`.

Se preferir manter a extensão, troque o `returnURL` no `index.html` para
`https://aulao.academycards.com.br/obrigado.html`.

---

## Decisões de design registradas

- **Tipografia:** Nunito em toda a página, a fonte oficial do manual da
  Academy Cards. Os títulos usam peso 800 com tracking fechado para ganhar
  presença de display sem sair da família da marca.
- **Fundo:** navy `#001A27` da Academy com um bloom teal `#18434A` da Taci, as
  duas marcas misturadas na luz. Atrás disso, uma pauta de folha de redação em
  opacidade mínima, o sinal de "redação" sem clichê.
- **Azul `#3FBFFF`:** reservado ao CTA e à tag do topo, para que o botão seja o
  ponto mais luminoso da tela. É a combinação sancionada no manual (azul
  primário sobre navy).
- **Assets deixados de fora, de propósito:** o mascote Axel (competiria com o
  rosto da professora e faria a página parecer promocional da Academy Cards),
  `background 3.png` (802 KB, briga com o hero escuro), `logo-footer.svg` (é um
  PNG embutido, não escala) e `logo-provasocial.png` (raster redundante de
  `logo-hero.svg`).
- **Hierarquia do hero:** a linha de data (`08 de outubro · 20h · On-line e
  gratuito`) fica logo abaixo do subtítulo, porque é a informação que mais
  decide a inscrição. Os chips mais abaixo repetem a data de propósito, como
  âncora visual da coluna de apoio.
- **Desktop = duas colunas de verdade.** Todo o conteúdo fica na coluna
  esquerda (título, data, foto) e o formulário é a coluna irmã, alinhada ao
  topo, ao lado do título. O botão fecha por volta de 555px, dentro da dobra
  até em janelas de 720px de altura.
- **O layout de 3 blocos só ativa a partir de 1200px.** Antes disso ele ativava
  em 1024px e a coluna de apoio colapsava para ~147px, quebrando o texto em
  linhas de duas palavras. Abaixo de 1200px tudo empilha.
- **Sem travessão em nenhum texto da página** (nem em `<title>`, metatags OG ou
  JSON-LD). Preferência do cliente. Vale também para os comentários do código.
- **Não existe linha abaixo do botão.** A microcopy no topo do card já explica
  por que e-mail e WhatsApp importam; repetir isso embaixo era a mesma
  informação duas vezes em 200px.
- **A foto não foi recortada do fundo:** o recorte de cabelo sem ferramenta
  adequada ficaria sujo. Em vez disso, a foto tem moldura arredondada e um fade
  na borda inferior, para emergir do escuro em vez de virar um retângulo claro
  colado.
- **O hero do desktop é uma faixa de altura única.** O título ocupa o topo em
  duas linhas; abaixo, foto, texto e formulário começam e terminam na mesma
  altura (o formulário é o mais alto e define a medida, a foto se estica com
  `object-fit: cover` para acompanhá-lo). Foi assim que sumiram o vão à direita
  e a rolagem antes do formulário: em telas de 900px, o botão de inscrição
  aparece sem rolar.
- **O crédito da professora é um bloco de texto, não uma legenda sobre a foto.**
  Sobreposto, ele caía em cima da camisa branca e não tinha contraste; como
  bloco próprio ele lê sempre e ainda ocupa a folga da coluna do meio.
