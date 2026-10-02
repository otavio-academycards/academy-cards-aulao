#!/usr/bin/env bash
#
# Publica a landing page num bucket S3.
#
#   S3_BUCKET=meu-bucket ./deploy.sh
#   S3_BUCKET=meu-bucket CF_DISTRIBUTION_ID=E123ABC ./deploy.sh   # com CloudFront
#   S3_BUCKET=meu-bucket DRY_RUN=1 ./deploy.sh                    # so mostra o que faria
#
# Sobe APENAS index.html, obrigado.html e assets/.
# Nao sobe identidade-academy/, identidade-taci/, tools/, emails/ nem README.md.
#
# Tres coisas que este script resolve e que quebram se voce subir na mao:
#
#   1. /obrigado sem extensao. O returnURL do Zoho aponta para
#      https://aulao.academycards.com.br/obrigado. O S3 nao serve obrigado.html
#      nesse caminho, entao o inscrito cairia num 404 logo depois de converter.
#      A pagina sobe em tres chaves: obrigado.html, obrigado (sem extensao) e
#      obrigado/index.html. Assim funciona no endpoint de site, no endpoint REST
#      e atras do CloudFront, sem depender de qual voce usa.
#
#   2. Content-Type no Windows. O `aws s3 sync` deduz o tipo pelo registro do
#      Windows, que em algumas maquinas devolve application/octet-stream para
#      .js e .css. O navegador entao recusa o arquivo e a pagina sobe sem estilo
#      e sem validacao de formulario. Aqui todo tipo critico vai explicito.
#
#   3. Cache. Os nomes dos arquivos nao tem hash, entao styles.css continua
#      styles.css a cada deploy. HTML, CSS e JS sobem com no-cache, para a
#      proxima alteracao aparecer na hora; fontes e imagens, que raramente
#      mudam, ficam com 7 dias.

set -euo pipefail

BUCKET="${S3_BUCKET:?Defina S3_BUCKET, ex: S3_BUCKET=aulao-academycards ./deploy.sh}"
DIST="${CF_DISTRIBUTION_ID:-}"
DRY="${DRY_RUN:-}"

cd "$(dirname "$0")"

AWS=(aws)
[ -n "$DRY" ] && AWS+=(--dryrun) || true

HTML='text/html; charset=utf-8'
NOCACHE='no-cache, must-revalidate'
LONGCACHE='public, max-age=604800'

echo ">> bucket: s3://$BUCKET"
[ -n "$DRY" ] && echo ">> DRY RUN: nada sera enviado"

# --- 1. assets: sobe tudo e remove do bucket o que nao existe mais aqui -------
aws s3 sync assets/ "s3://$BUCKET/assets/" \
  --delete \
  --cache-control "$LONGCACHE" \
  ${DRY:+--dryrun}

# --- 2. corrige Content-Type e cache do que o sync pode ter errado -----------
if [ -z "$DRY" ]; then
  aws s3 cp assets/css/ "s3://$BUCKET/assets/css/" --recursive \
    --content-type 'text/css; charset=utf-8' --cache-control "$NOCACHE"

  aws s3 cp assets/js/ "s3://$BUCKET/assets/js/" --recursive \
    --content-type 'text/javascript; charset=utf-8' --cache-control "$NOCACHE"

  aws s3 cp assets/fonts/nunito.woff2 "s3://$BUCKET/assets/fonts/nunito.woff2" \
    --content-type 'font/woff2' --cache-control "$LONGCACHE"

  for svg in assets/img/*.svg; do
    aws s3 cp "$svg" "s3://$BUCKET/$svg" \
      --content-type 'image/svg+xml' --cache-control "$LONGCACHE"
  done
fi

# --- 3. paginas --------------------------------------------------------------
if [ -z "$DRY" ]; then
  aws s3 cp index.html "s3://$BUCKET/index.html" \
    --content-type "$HTML" --cache-control "$NOCACHE"

  # as tres chaves do /obrigado (ver nota 1 no topo)
  aws s3 cp obrigado.html "s3://$BUCKET/obrigado.html" \
    --content-type "$HTML" --cache-control "$NOCACHE"
  aws s3 cp obrigado.html "s3://$BUCKET/obrigado" \
    --content-type "$HTML" --cache-control "$NOCACHE"
  aws s3 cp obrigado.html "s3://$BUCKET/obrigado/index.html" \
    --content-type "$HTML" --cache-control "$NOCACHE"
fi

# --- 4. CloudFront -----------------------------------------------------------
if [ -n "$DIST" ] && [ -z "$DRY" ]; then
  echo ">> invalidando CloudFront $DIST"
  aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' \
    --query 'Invalidation.Id' --output text
fi

echo
echo ">> pronto."
echo "   Confira depois do deploy:"
echo "     - a pagina abre e aparece com estilo (CSS carregou)"
echo "     - /obrigado abre sem 404"
echo "     - DevTools > Network: styles.css como text/css e main.js como text/javascript"
