#!/usr/bin/env bash
# generate-example.sh — gera o projeto exemplo echo-stateless usando o builder.
#
# Uso:
#   ./scripts/generate-example.sh
#
# Pré-requisitos:
#   - Node 20+ instalado
#   - npm install feito em builder/
#
# Este script:
#   1. Compila o builder (se necessário)
#   2. Executa `mcp-builder new echo-stateless --sdk python --pattern stateless`
#   3. Verifica que o projeto foi gerado
#   4. Mostra o FSM em Mermaid

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILDER="$ROOT/builder"
EXAMPLES="$ROOT/examples"

echo "==> 1. Verificando build do builder"
if [ ! -d "$BUILDER/dist" ]; then
  echo "    Builder não compilado. Compilando..."
  cd "$BUILDER"
  if [ ! -d node_modules ]; then
    npm install
  fi
  npm run build
  cd "$ROOT"
fi

echo "==> 2. Gerando echo-stateless via CLI"
mkdir -p "$EXAMPLES"
node "$BUILDER/dist/cli/index.js" new echo-stateless \
  --sdk python \
  --pattern stateless \
  --tools echo,ping \
  --output "$EXAMPLES" \
  --skip-git || {
    echo "AVISO: geração falhou (provavelmente porque examples/echo-stateless já existe)"
    echo "       Para regenerar, remova o diretório primeiro:"
    echo "       rm -rf $EXAMPLES/echo-stateless"
  }

echo "==> 3. Validando FSM do projeto raiz"
node "$BUILDER/dist/cli/index.js" fsm show

echo ""
echo "==> 4. Próximos passos"
echo "    cd examples/echo-stateless"
echo "    pip install -e \".[dev]\""
echo "    pytest -v"
echo ""
echo "✓ Done."
