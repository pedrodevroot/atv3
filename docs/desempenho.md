# Desempenho, resiliência e precisão

Este documento registra como o microsserviço atende aos requisitos não funcionais de desempenho (RNF01, RNF02), precisão (RNF03) e tolerância a falhas (RNF05), com as medições feitas e como reproduzi-las.

## Ambiente de medição

| Item       | Valor                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Máquina    | notebook Windows 11, 8 threads de CPU, 7,6 GB para o Docker                                                                                                                               |
| Banco      | PostgreSQL 18 em Docker (mesma máquina)                                                                                                                                                   |
| Cadastro   | 10.000 profissionais gerados por `npm run seed` (9.486 ativos, 60 mil avaliações)                                                                                                         |
| Serviço    | `node dist/cluster.js` com 8 processos, `LOG_LEVEL=warn`, `DB_POOL_MAX=64` (repartido entre os processos)                                                                                 |
| Carga      | `autocannon` rodando **na mesma máquina** (disputa CPU com o serviço e o banco)                                                                                                           |
| Requisição | `POST /projetos` com os 6 papéis, estratégia `filtragem-colaborativa`: cria o projeto, ranqueia 10 mil profissionais para 6 papéis, monta 3 equipes, grava tudo e dispara os observadores |

O cenário é pessimista: em produção o gerador de carga não divide a CPU com o serviço.

## Resultados (RNF01 e RNF02)

| Cenário                             | Requisições | Vazão    | p50    | p90    | p97,5  | p99        | Máximo     | Erros |
| ----------------------------------- | ----------- | -------- | ------ | ------ | ------ | ---------- | ---------- | ----- |
| Requisição isolada                  | 1           | -        | 0,27 s | -      | -      | -          | -          | 0     |
| Rajada: 100 requisições simultâneas | 100         | -        | 1,68 s | 1,77 s | 1,80 s | 1,81 s     | **1,81 s** | **0** |
| Sustentado: 100 conexões por 30 s   | 2.619       | 87 req/s | 1,09 s | 1,45 s | 1,67 s | **1,76 s** | 2,19 s     | **0** |

- **RNF01 (< 2 s com 10 mil profissionais):** uma recomendação isolada leva 0,27 s; na rajada de 100 simultâneas todas terminam abaixo de 2 s.
- **RNF02 (100 requisições simultâneas):** 100 conexões mantidas por 30 s sem nenhum erro, timeout ou resposta não-2xx; p99 de 1,76 s.
- Com 100 requisições sempre em andamento, a latência média segue a Lei de Little: 100 / 87 req/s ≈ 1,1 s, que é o valor medido.
- **Depois da ATVII**, no mesmo ambiente e com o cache aquecido: requisição isolada de 0,26 s a 0,31 s; rajada de 100 simultâneas com p50 de 0,82 s a 0,89 s, máximo de 0,89 s a 0,95 s e 0 erros. Medições feitas enquanto outros containers disputavam a CPU chegaram a 2,7 s, o que mostra que o resultado depende da carga da máquina.

## Como chegamos lá

Cada etapa foi medida antes de otimizar (profiler de CPU do Node e `pg_stat_activity`):

| Etapa | Problema medido                                                                        | Correção                                                                              | Efeito                                              |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1     | Cada requisição relia ~8,5 mil profissionais do banco (~1 s)                           | Cache em memória do cadastro, indexado por papel                                      | Requisição isolada: 2,9 s → 0,27 s                  |
| 2     | `localeCompare` com locale recria um _collator_ a cada chamada (60 mil por requisição) | Normalização de texto memorizada                                                      | Ranking da filtragem colaborativa ~6x mais rápido   |
| 3     | Pool do PostgreSQL esgotava (`timeout exceeded when trying to connect`)                | Mensagens internas gravadas em lote (1 INSERT por evento) e pool ajustado             | Erros sob carga: 100% → 0%                          |
| 4     | Node usa uma thread: vazão limitada a ~16 req/s                                        | `node:cluster` com round-robin e pool repartido entre os processos                    | 16 → 45 req/s                                       |
| 5     | Os 8 processos recarregavam o cache juntos (PostgreSQL a 256% de CPU)                  | TTL de 5 min com variação aleatória de ±20%                                           | Recargas deixam de coincidir                        |
| 6     | O ranqueador criava objeto e texto de justificativa para ~10 mil candidatos            | Pontua primeiro, seleciona os top-N por inserção parcial e só justifica os vencedores | CPU por requisição: 40 → 22 ms; vazão 45 → 87 req/s |

## Resiliência (RNF05)

O cadastro de profissionais é tratado como dependência externa e passa por `RepositorioProfissionaisResiliente`:

| Situação                       | Comportamento                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cache válido                   | Busca em memória, sem ir ao banco                                                                                                                       |
| TTL vencido                    | Responde na hora com o snapshot e recarrega em segundo plano, uma recarga por vez (_single-flight_)                                                     |
| Banco lento                    | A carga tem tempo limite (`CADASTRO_TIMEOUT_MS`, padrão 10 s)                                                                                           |
| Banco falhando                 | Após `CIRCUITO_LIMITE_FALHAS` falhas seguidas o disjuntor abre por `CIRCUITO_ESPERA_MS` e novas tentativas são bloqueadas; depois passa por meio-aberto |
| Banco fora do ar, com snapshot | Recomenda com o último snapshot e responde `parcial: true` com aviso da data do cache                                                                   |
| Banco fora do ar, sem snapshot | Não lança erro: devolve `parcial: true`, lista vazia e aviso; a API sinaliza os papéis sem candidatos                                                   |
| Outras falhas de banco na API  | `503 SERVICO_INDISPONIVEL` com `retry-after: 5`                                                                                                         |

O estado do cache e do disjuntor aparece em `GET /health` como a dependência `cadastro-profissionais`. Os cenários estão testados em `tests/unit/infrastructure/resiliencia.test.ts`.

## Precisão das recomendações (RNF03)

`npm run precisao` mede a **precision@5**: para 20 projetos sintéticos × 6 papéis, os relevantes são os 10% mais qualificados entre os candidatos elegíveis, segundo a qualidade latente usada pelo gerador do cadastro (o "gabarito" que o sistema não enxerga).

Medição refeita depois da ATVII, que incluiu o tipo `PUBLICITARIO` no cadastro gerado e
passou os ajustes de perfil por tipo para o recomendador de cada família:

| Configuração                                                | precision@5 |
| ----------------------------------------------------------- | ----------- |
| Linha de base (aleatória)                                   | 0,227       |
| **recomendador do tipo do projeto (padrão da ATVII)**       | **0,457**   |
| similaridade-cosseno genérica, com aderência                | 0,427       |
| similaridade-cosseno, versão original (só direção do vetor) | 0,034       |
| filtragem-colaborativa (padrão)                             | **0,852**   |
| filtragem-colaborativa (priori fraca)                       | 0,703       |
| regras-orcamento (padrão)                                   | 0,360       |
| regras-orcamento (prioriza nota)                            | 0,590       |

A métrica mostrou que o cosseno puro ficava abaixo do aleatório: ele mede só _quais_ competências o profissional tem, não _em que nível_. A estratégia ganhou o componente de **aderência** (projeção do vetor do profissional sobre o perfil ideal), com peso parametrizável, e a precisão subiu de 0,044 para 0,430. É o ciclo "mensurável e melhorável": todos os pesos estão em `ParametrosRecomendacao` e podem ser enviados em cada requisição.

Limitação: o gabarito é sintético. Em produção, o mesmo `avaliarPrecisao` pode usar como relevantes os profissionais que o produtor aceitou ou que foram bem avaliados após o projeto.

## Como reproduzir

```bash
npm run db:up
npm run migration:run
npm run seed
npm run build
# PowerShell: $env:NODE_ENV='production'; $env:LOG_LEVEL='warn'; $env:WEB_CONCURRENCY='8'; $env:DB_POOL_MAX='64'
NODE_ENV=production LOG_LEVEL=warn WEB_CONCURRENCY=8 DB_POOL_MAX=64 npm run start:cluster
```

Em outro terminal, com um corpo de `POST /projetos` salvo em `corpo.json` (há um exemplo em `requests.http`):

```bash
PERF_URL=http://localhost:3000/projetos PERF_METODO=POST PERF_CORPO=corpo.json \
  PERF_CONEXOES=100 PERF_QUANTIDADE=100 PERF_PERCENTIL=max npm run perf

PERF_URL=http://localhost:3000/projetos PERF_METODO=POST PERF_CORPO=corpo.json \
  PERF_CONEXOES=100 PERF_DURACAO=30 PERF_PERCENTIL=p97_5 npm run perf

npm run precisao
```

`npm run test:desempenho` verifica em CI que cada estratégia ranqueia 10 mil profissionais para 6 papéis em menos de 2 s.
