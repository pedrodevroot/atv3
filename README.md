# CineBridge — Microsserviço de Recomendação e Orquestração de Equipes

API REST que recebe um projeto audiovisual, ranqueia os profissionais cadastrados
para cada papel técnico e monta sugestões de equipe dentro do orçamento e do prazo,
notificando os envolvidos e registrando tudo em auditoria. Cada tipo de projeto
(documentário, animação, publicidade e ficção) tem os próprios dados, regras de
validação, recomendador e avisos.

Primeiro microsserviço da plataforma **CineBridge** — os próximos (gerenciamento de
projetos, financeiro) serão containers independentes na mesma rede Docker e no
mesmo PostgreSQL, cada um com seu próprio banco.

**Atividades ATVI e ATVII** — Técnicas de Programação — Prof. Dr. Eng. Gerson Penha

| Atividade | O que entrega                                                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ATVI**  | O microsserviço com **Strategy**, **Template Method**, **Observer** e **Visitor**                                                                                 |
| **ATVII** | Análise crítica do código da ATVI ([docs/analise-critica.md](docs/analise-critica.md)) e refatoração com **Prototype**, **Factory Method** e **Abstract Factory** |

---

## Tecnologias

|                           | Versão |
| ------------------------- | ------ |
| Node.js (LTS)             | 22     |
| TypeScript (modo estrito) | 6      |
| Fastify + TypeBox         | 5 / 1  |
| TypeORM                   | 1.1    |
| PostgreSQL                | 18     |
| Vitest                    | 5      |
| Docker Compose            | —      |

## O que precisa estar instalado na máquina

| Programa                                          | Para quê                               | Download                                       |
| ------------------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| **Git**                                           | clonar o repositório                   | https://git-scm.com/downloads                  |
| **Docker Desktop** (ou Docker + Compose no Linux) | executar a API e o PostgreSQL          | https://www.docker.com/products/docker-desktop |
| **Node.js 22.12+** (LTS, versão no `.nvmrc`)      | testes, demonstração e desenvolvimento | https://nodejs.org                             |

Para **só executar a API** bastam Git e Docker: o `Dockerfile` instala as
dependências, compila o TypeScript e gera a imagem final só com o código compilado
e as dependências de produção.

As portas `3000` (API) e `5434` (PostgreSQL) precisam estar livres.

| Para                                              | Precisa                                         |
| ------------------------------------------------- | ----------------------------------------------- |
| Executar a API (`docker compose up`)              | Git e Docker                                    |
| Rodar a demonstração dos padrões (`npm run demo`) | **Node.js 22.12+**                              |
| Rodar os testes, a cobertura e o teste de carga   | **Node.js 22.12+** e Docker (para o PostgreSQL) |
| Desenvolver (`npm run dev`)                       | **Node.js 22.12+** e Docker (para o PostgreSQL) |

Para conferir: `git --version`, `docker --version` e `node -v`.

Com o Node instalado, rode `npm ci` uma vez na pasta do projeto antes de qualquer
comando `npm run`.

---

## Como executar

```bash
git clone https://github.com/pedrodevroot/atv2.git
cd atv2
docker compose up -d --build --wait
```

Nada para configurar: usuário, senha e nome do banco têm valor padrão no
`docker-compose.yml`. O mesmo comando funciona no Windows (PowerShell) e no Ubuntu.

|                                   | Endereço                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| API                               | http://localhost:3000                                                         |
| Documentação interativa (Swagger) | http://localhost:3000/docs                                                    |
| PostgreSQL                        | localhost:5434 — base `cinebridge_recomendacao`, usuário/senha `recomendacao` |

O comando sobe dois containers: o PostgreSQL compartilhado e o microsserviço. Na
primeira subida o microsserviço aplica as migrações e cadastra **10.000
profissionais** de demonstração (cerca de 30 segundos; desligável com
`SEED_AO_INICIAR=false`). A API roda em cluster com 4 processos
(`WEB_CONCURRENCY`).

### Conferir se subiu

```bash
docker compose ps
curl http://localhost:3000/health      # no PowerShell use curl.exe
```

```json
{
  "status": "ok",
  "dependencias": { "postgres": "disponivel", "cadastro-profissionais": "disponivel" }
}
```

### Testar pela API

- **Swagger** (http://localhost:3000/docs): abra a rota, clique em **Try it out**, preencha os
  campos e o corpo e clique em **Execute**. Os ids (`projetoId`, `equipeId`, `conviteId`) vêm nas
  respostas e são usados nas rotas seguintes.
- **[requests.http](requests.http)** (extensão REST Client do VS Code): o fluxo inteiro, na ordem,
  incluindo os exemplos da ATVII.

Os corpos prontos para copiar estão em [Endpoints](#endpoints). As datas dos projetos precisam
estar no futuro: a entrega não pode ter passado.

### Parar

```bash
docker compose down        # para os containers e mantém os dados
docker compose down -v     # para e apaga o banco
```

### Executar fora do Docker (desenvolvimento)

```bash
npm ci
cp .env.example .env       # PowerShell: Copy-Item .env.example .env
npm run db:up              # só o PostgreSQL, em localhost:5434
npm run db:preparar        # migrações + seed de 10 mil profissionais se o banco estiver vazio
npm run dev                # http://localhost:3000, recarrega ao salvar
```

---

## Os sete padrões de projeto

Precisa do **Node.js 22.12+**; não precisa de Docker nem de banco.

```bash
npm ci
npm run demo
```

Imprime as sete demonstrações: as quatro da ATVI e as três da ATVII.

| Padrão               | Onde está                                                  | O que a demonstração prova                                                                                                                                           | Teste                                   |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Strategy**         | `src/application/strategies`                               | Mesmo projeto e mesmo cadastro: cosseno escolhe Helena Técnica, colaborativa escolhe Marta Consagrada, regras de orçamento escolhem Caio Local                       | `demonstracao-strategy.test.ts`         |
| **Template Method**  | `src/application/orchestration`                            | `OrquestradorPadrao` e `OrquestradorSubstituicao` executam as mesmas 7 etapas; falha na validação interrompe antes de buscar; sobrescrever `orquestrar()` é recusado | `demonstracao-template-method.test.ts`  |
| **Observer**         | `src/application/observers` + `infrastructure/messaging`   | Um observador falha e e-mail, mensagem interna, auditoria e integração continuam; entrega assíncrona; observador lento não atrasa os demais                          | `demonstracao-observer.test.ts`         |
| **Visitor**          | `src/application/visitors`                                 | Validação, compatibilidade e relatório sobre a mesma árvore; a árvore não muda; um visitante novo não exige alterar o domínio                                        | `demonstracao-visitor.test.ts`          |
| **Prototype**        | `src/domain/entidades/projetos` + `application/prototipos` | `clonar()` em cada subclasse de `Projeto` faz cópia profunda; modelos pré-configurados são clonados e ajustados; mexer no clone não altera o protótipo               | `demonstracao-prototype.test.ts`        |
| **Factory Method**   | `src/application/familias/*/fabrica-*.ts`                  | `criarProjeto`, `criarValidador`, `criarRecomendador` e `criarNotificador` são abstratos em `FabricaProjeto`; cada subclasse decide a classe concreta                | `demonstracao-abstract-factory.test.ts` |
| **Abstract Factory** | `src/application/familias` + `sistema-recomendacao.ts`     | Mesmo cadastro e mesmos papéis: trocar a fábrica troca recomendação, validação e notificação; um tipo novo entra só com uma fábrica nova                             | `fabricas-projeto.test.ts` (integração) |

A classe `SistemaRecomendacao` (`src/application/sistema-recomendacao.ts`) reproduz a API dos
diagramas das atividades — `definirEstrategia`, `executarRecomendacao`, `adicionarObservador` e
`notificarObservadores` —, unindo Strategy e Observer; desde a ATVII ela também identifica o tipo
do projeto e escolhe a fábrica (teste `sistema-recomendacao.test.ts`). A interface
`RecomendacaoStrategy` dos diagramas corresponde a `EstrategiaRecomendacao`.

---

## Tipos de projeto (ATVII)

Cada tipo de projeto é uma **família** de objetos criada pela sua fábrica:

| Tipo           | Projeto (Prototype)                              | Validador (Visitor)                                                              | Recomendador (Strategy)                                           | Avisos ao produtor (Observer)                 |
| -------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| `DOCUMENTARIO` | `ProjetoDocumentario`: tema, entrevistados       | erro sem entrevistado; alerta sem sonoplasta; alerta se a direção não entrevista | perfil com entrevista e pesquisa na direção, som direto reforçado | agenda de entrevistas, autorizações de imagem |
| `ANIMACAO`     | `ProjetoAnimacao`: técnica, softwares, quadros/s | erro sem `EFEITOS_VISUAIS`; alerta sem softwares; alerta se VFX não modela/anima | perfil com animação, modelagem 3D e os softwares do projeto       | softwares 3D, capacidade de renderização      |
| `PUBLICITARIO` | `ProjetoPublicitario`: marca, veiculação, peças  | erro sem meio de veiculação; alerta com prazo acima de 90 dias                   | perfil com decupagem, color grading, ritmo e trilha               | aprovação do cliente, briefing da marca       |
| `FICCAO`       | `ProjetoFiccao`: o projeto da ATVI               | alerta se a direção não dirige atores                                            | perfil com direção de atores e dramaturgia                        | leitura de roteiro, plano de filmagem         |

O relatório da animação também traz **métricas de renderização**: quadros a produzir, ritmo
diário, horas de render estimadas e custo de efeitos visuais por quadro.

Como as peças se ligam:

1. `CriarProjetoERecomendar` pede ao `RegistroFabricas` a fábrica do `tipoCaptacao` e cria o
   projeto com `fabrica.criarProjeto(dados)`.
2. `SistemaRecomendacao.criarEcossistema(projeto)` identifica o tipo, seleciona a fábrica e monta
   com ela o orquestrador, o validador, o recomendador e o notificador.
3. `OrquestradorEquipe` recebe a fábrica no construtor. Na etapa de validação aplica
   `fabrica.criarValidador()`; se o produtor não escolheu estratégia, ranqueia com
   `fabrica.criarRecomendador()`. O fluxo de 7 etapas da ATVI não mudou, e o código do
   orquestrador não cita nenhum tipo concreto (um teste confere isso).
4. Os eventos do projeto vão para os observadores da ATVI **e** para o notificador da fábrica; o
   relatório é feito pelo gerador da fábrica (`criarGeradorRelatorio`).
5. `CatalogoModelos` guarda protótipos prontos (`documentario-entrevistas`, `animacao-3d-curta`,
   `publicitario-digital`, `ficcao-longa`); um projeto novo pode nascer como clone de um modelo,
   com os ajustes do produtor.

Decisões de projeto (os motivos estão na [análise crítica](docs/analise-critica.md)):

- `FICCAO` foi mantido, com fábrica própria, para não quebrar o que a ATVI entregou;
- o clone ganha id novo e não herda as equipes do original;
- a estratégia escolhida pelo produtor prevalece sobre o recomendador do tipo;
- a fábrica fica fora da entidade `Projeto`, para preservar a inversão de dependência;
- as regras do tipo valem para rodadas completas e não bloqueiam a substituição de um único papel.

Para acrescentar um tipo (por exemplo, realidade virtual): crie a subclasse de `Projeto`, o
validador, o recomendador, o notificador e a fábrica, e registre a fábrica em
`criarRegistroFabricas` (`src/container.ts`). Orquestrador, `SistemaRecomendacao`, casos de uso e
repositórios não mudam; o teste `fabricas-projeto.test.ts` faz isso com uma fábrica criada só no
teste.

---

## Como executar os testes

```bash
npm ci
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm run db:up             # os testes de integração usam o PostgreSQL do Docker
npm test                  # todos
npm run test:unit         # só os unitários, sem banco
npm run test:int          # só os de integração com o PostgreSQL
npm run test:desempenho   # só os de desempenho com 10 mil profissionais
npm run coverage          # todos, reprovando abaixo de 80% de cobertura
```

São **390 testes automatizados**, em cerca de 25 segundos. Os de integração rodam
num schema separado (`teste_integracao`) e não apagam os dados de
desenvolvimento.

| Camada                                                           | Testes | Ferramenta              |
| ---------------------------------------------------------------- | ------ | ----------------------- |
| Domínio (entidades, value objects, eventos)                      | 86     | Vitest                  |
| Strategy                                                         | 53     | Vitest                  |
| Template Method                                                  | 25     | Vitest                  |
| Observer                                                         | 24     | Vitest                  |
| Visitor                                                          | 19     | Vitest                  |
| Prototype (subclasses de `Projeto`, `clonar()` e detalhes)       | 16     | Vitest                  |
| Factory Method e Abstract Factory (famílias, registro, sistema)  | 23     | Vitest                  |
| Aplicação (sistema, saúde, precisão, concorrência, convites)     | 20     | Vitest                  |
| Infraestrutura (config, cache, disjuntor, barramento, varredura) | 43     | Vitest                  |
| Catálogo de modelos e API de tipos e modelos                     | 13     | Vitest + `app.inject()` |
| API HTTP com repositórios em memória                             | 34     | Vitest + `app.inject()` |
| Integração com PostgreSQL (repositórios, API, fábricas, falhas)  | 31     | Vitest + PostgreSQL 18  |
| Desempenho com 10 mil profissionais                              | 3      | Vitest                  |

Cobertura: **99,0% das linhas** (mínimo exigido: 80%). O CI roda lint, tipos,
build e testes no **Ubuntu 24.04 e no Windows**, com Node 22 e 24, além da
integração com PostgreSQL e da subida da stack Docker.

| Comando                   | O que faz                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `npm run lint`            | ESLint sem nenhum warning (inclui regra que proíbe comentários e `any`) + Prettier |
| `npm run typecheck`       | TypeScript estrito no código e nos testes                                          |
| `npm run test:desempenho` | Cada estratégia ranqueia 10 mil profissionais para 6 papéis em menos de 2 s        |
| `npm run perf`            | Teste de carga (ver [docs/desempenho.md](docs/desempenho.md))                      |
| `npm run precisao`        | Precision@5 de cada estratégia, incluindo o recomendador de cada tipo              |

---

## Endpoints

Base: `http://localhost:3000` — todos também em http://localhost:3000/docs e em
[requests.http](requests.http) (extensão REST Client do VS Code), na ordem do fluxo.

Em todo `POST` e `PATCH` o corpo é JSON (`Content-Type: application/json`). O header
`x-request-id` é opcional e vira o `correlacaoId` da auditoria; é aceito com até 64 caracteres
(letras, números, `.`, `_`, `:` e `-`). Fora disso a API gera um id novo e o devolve no mesmo
header.

### Projetos e recomendações

| Método  | URL                                                        | Corpo | Esperado |
| ------- | ---------------------------------------------------------- | ----- | -------- |
| `GET`   | `http://localhost:3000/estrategias`                        | —     | 200      |
| `POST`  | `http://localhost:3000/projetos`                           | **A** | 201      |
| `GET`   | `http://localhost:3000/projetos/{projetoId}`               | —     | 200      |
| `POST`  | `http://localhost:3000/projetos/{projetoId}/recomendacoes` | **B** | 201      |
| `GET`   | `http://localhost:3000/projetos/{projetoId}/recomendacoes` | —     | 200      |
| `POST`  | `http://localhost:3000/projetos/{projetoId}/reavaliacao`   | **C** | 200      |
| `PATCH` | `http://localhost:3000/projetos/{projetoId}/detalhes`      | **G** | 200      |

### Equipe e convites

| Método   | URL                                                                                         | Corpo | Esperado                    |
| -------- | ------------------------------------------------------------------------------------------- | ----- | --------------------------- |
| `POST`   | `http://localhost:3000/projetos/{projetoId}/equipes/{equipeId}/membros/DIRETOR/aceite`      | —     | 201, cria o convite         |
| `POST`   | `http://localhost:3000/convites/{conviteId}/resposta`                                       | **D** | 200                         |
| `DELETE` | `http://localhost:3000/projetos/{projetoId}/equipes/{equipeId}/membros/EDITOR`              | —     | 200, papel fica vago        |
| `POST`   | `http://localhost:3000/projetos/{projetoId}/equipes/{equipeId}/membros/EDITOR/substituicao` | **E** | 200                         |
| `POST`   | `http://localhost:3000/projetos/{projetoId}/equipes/{equipeId}/finalizacao`                 | —     | 200, após todos confirmarem |

Papéis aceitos na URL: `DIRETOR`, `DIRETOR_FOTOGRAFIA`, `SONOPLASTA`, `EDITOR`,
`ROTEIRISTA`, `EFEITOS_VISUAIS`.

Convites valem 72 h. Uma varredura a cada `CONVITES_VARREDURA_MS` (padrão 60 s) expira os
vencidos: o papel é liberado, produtor e profissional recebem aviso e uma nova rodada é feita só
para aquele papel, como numa recusa. Se a nova rodada não puder acontecer (por exemplo, sem
orçamento restante), a recusa fica registrada e o produtor recebe "Sem substituto automático para
o papel", com o motivo. Quando uma equipe é descartada (nova rodada, reavaliação significativa
ou formação de outra equipe), os convites pendentes dela são cancelados.

### Tipos e modelos de projeto

| Método | URL                                                         | Corpo | Esperado |
| ------ | ----------------------------------------------------------- | ----- | -------- |
| `GET`  | `http://localhost:3000/tipos-projeto`                       | —     | 200      |
| `GET`  | `http://localhost:3000/modelos-projeto`                     | —     | 200      |
| `POST` | `http://localhost:3000/modelos-projeto/{modeloId}/projetos` | **F** | 201      |

Modelos disponíveis: `documentario-entrevistas`, `animacao-3d-curta`, `publicitario-digital` e
`ficcao-longa`.

### Relatórios e consultas

| Método | URL                                                                       | Corpo | Esperado |
| ------ | ------------------------------------------------------------------------- | ----- | -------- |
| `GET`  | `http://localhost:3000/projetos/{projetoId}/relatorio`                    | —     | 200      |
| `GET`  | `http://localhost:3000/projetos/{projetoId}/equipes/{equipeId}/relatorio` | —     | 200      |
| `GET`  | `http://localhost:3000/projetos/{projetoId}/auditoria`                    | —     | 200      |
| `GET`  | `http://localhost:3000/mensagens/produtor-1`                              | —     | 200      |
| `GET`  | `http://localhost:3000/health`                                            | —     | 200      |

### Corpos

**A** — novo projeto (a resposta já traz as equipes sugeridas e o ranking por papel)

```json
{
  "titulo": "Vozes do Sertão",
  "produtorId": "produtor-1",
  "genero": "drama",
  "tipoCaptacao": "FICCAO",
  "duracaoMinutos": 95,
  "orcamento": 280000,
  "dataInicio": "2027-03-01T00:00:00.000Z",
  "dataEntrega": "2027-06-30T00:00:00.000Z",
  "localizacao": { "cidade": "São Paulo", "uf": "SP", "latitude": -23.5505, "longitude": -46.6333 },
  "requisitos": [
    { "papel": "DIRETOR", "peso": 10 },
    { "papel": "DIRETOR_FOTOGRAFIA", "peso": 8 },
    { "papel": "ROTEIRISTA", "peso": 7 },
    { "papel": "EDITOR", "peso": 6 },
    { "papel": "SONOPLASTA", "peso": 5 },
    { "papel": "EFEITOS_VISUAIS", "peso": 3 }
  ],
  "estrategia": "similaridade-cosseno"
}
```

`tipoCaptacao`: `DOCUMENTARIO`, `FICCAO`, `ANIMACAO` ou `PUBLICITARIO`. `estrategia` é
opcional: sem ela, orçamentos até R$ 50 mil usam `regras-orcamento` e os demais usam o
recomendador do tipo (`recomendador-ficcao`, `recomendador-documentario`, ...).

`detalhes` não existe na ficção e traz os atributos específicos dos outros tipos:

| Tipo           | `detalhes`                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| `DOCUMENTARIO` | `{ "tema": "Rios do Cerrado", "entrevistados": ["Seu Tião"] }`             |
| `ANIMACAO`     | `{ "tecnica": "3D", "softwares": ["Blender"], "quadrosPorSegundo": 24 }`   |
| `PUBLICITARIO` | `{ "marca": "Café Serrano", "veiculacao": ["TV", "DIGITAL"], "pecas": 3 }` |

`tecnica`: `2D`, `3D` ou `STOP_MOTION`; `veiculacao`: `TV`, `DIGITAL` ou `CINEMA`;
`quadrosPorSegundo` padrão 24 e `pecas` padrão 1. Uma animação precisa ter `EFEITOS_VISUAIS` em
`requisitos`.

**B** — nova rodada com outra estratégia e parâmetros próprios (todos opcionais)

```json
{
  "estrategia": "filtragem-colaborativa",
  "parametros": {
    "topN": 5,
    "colaborativa": { "pesoPriori": 3 },
    "orquestracao": { "numeroSugestoes": 2 }
  }
}
```

**C** — reavaliação: acima de 15% de variação no orçamento ou no prazo a equipe é refeita

```json
{ "orcamento": 150000, "dataEntrega": "2027-07-31T00:00:00.000Z" }
```

**D** — resposta do profissional ao convite (recusa dispara nova rodada só para o papel)

```json
{ "aceito": true }
```

**E** — substituição, opcionalmente com outra estratégia

```json
{ "estrategia": "regras-orcamento" }
```

**F** — projeto a partir de um modelo (Prototype): título, produtor e datas são obrigatórios; os
demais campos do corpo **A** são opcionais e, quando enviados, ajustam o clone

```json
{
  "titulo": "Rios do Cerrado",
  "produtorId": "produtor-2",
  "dataInicio": "2027-03-01T00:00:00.000Z",
  "dataEntrega": "2027-06-30T00:00:00.000Z",
  "detalhes": { "tema": "Rios do Cerrado", "entrevistados": ["Seu Tião", "Dona Lia"] }
}
```

**G** — completa ou corrige os detalhes do tipo (mesclados aos atuais; só antes da equipe formada)

```json
{ "detalhes": { "entrevistados": ["Seu Tião", "Dona Lia"] } }
```

> Os `projetoId`, `equipeId` e `conviteId` são gerados pela API. O `POST /projetos`
> devolve `projeto.id` e `projeto.equipes[0].id`; o aceite devolve `convite.id`.

### Casos de erro

| Método   | URL                                                                                | Corpo                                     | Esperado                                   |
| -------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `GET`    | `http://localhost:3000/projetos/inexistente`                                       | —                                         | 404 `NAO_ENCONTRADO`                       |
| `POST`   | `http://localhost:3000/convites/inexistente/resposta`                              | **D**                                     | 404 `NAO_ENCONTRADO`                       |
| `POST`   | `http://localhost:3000/projetos`                                                   | `{ "titulo": "x" }`                       | 400 `REQUISICAO_INVALIDA`                  |
| `POST`   | `http://localhost:3000/projetos`                                                   | **A** com um campo a mais                 | 400 `REQUISICAO_INVALIDA`                  |
| `POST`   | `http://localhost:3000/projetos`                                                   | **A** com `"orcamento": 1e15`             | 400 `REQUISICAO_INVALIDA`                  |
| `POST`   | `http://localhost:3000/projetos`                                                   | **A** com `"estrategia": "aleatoria"`     | 400 `ESTRATEGIA_DESCONHECIDA`              |
| `POST`   | `http://localhost:3000/projetos`                                                   | **A** com `"orcamento": 1500`             | 422 `RESTRICAO_VIOLADA`                    |
| `POST`   | `http://localhost:3000/projetos`                                                   | **A** com `"dataEntrega"` antes do início | 422 `VALOR_INVALIDO`                       |
| `POST`   | `http://localhost:3000/projetos`                                                   | documentário sem entrevistados            | 422 `RESTRICAO_VIOLADA`                    |
| `POST`   | `http://localhost:3000/projetos`                                                   | animação sem `EFEITOS_VISUAIS`            | 422 `RESTRICAO_VIOLADA`                    |
| `POST`   | `http://localhost:3000/projetos`                                                   | publicidade com `"veiculacao": ["RADIO"]` | 422 `VALOR_INVALIDO`                       |
| `POST`   | `http://localhost:3000/projetos`                                                   | `detalhes` com campo que o tipo não tem   | 422 `VALOR_INVALIDO`                       |
| `POST`   | `http://localhost:3000/modelos-projeto/novela/projetos`                            | **F**                                     | 404 `NAO_ENCONTRADO`                       |
| `PATCH`  | `http://localhost:3000/projetos/{projetoId}/detalhes`                              | **G** depois da equipe formada            | 409 `TRANSICAO_INVALIDA`                   |
| `POST`   | `http://localhost:3000/projetos/{id}/equipes/{id}/membros/DIRETOR/aceite`          | repetido                                  | 409 `TRANSICAO_INVALIDA`                   |
| `POST`   | `http://localhost:3000/convites/{conviteId}/resposta`                              | repetido, vencido ou de equipe descartada | 409 `TRANSICAO_INVALIDA`                   |
| `POST`   | `http://localhost:3000/projetos/{id}/equipes/{id}/finalizacao`                     | com papel sem confirmar                   | 422 `REGRA_VIOLADA`                        |
| qualquer | com o PostgreSQL fora do ar                                                        | —                                         | 503 `SERVICO_INDISPONIVEL` + `retry-after` |
| qualquer | duas alterações simultâneas no mesmo projeto (após 6 novas tentativas automáticas) | —                                         | 409 `CONFLITO_CONCORRENCIA`                |

### Respostas de erro

```json
{
  "codigo": "REQUISICAO_INVALIDA",
  "mensagem": "A requisição não atende ao contrato esperado.",
  "detalhes": ["/orcamento: must be > 0"]
}
```

Erros de regra de negócio trazem só `codigo` e `mensagem`, por exemplo
`{ "codigo": "RESTRICAO_VIOLADA", "mensagem": "Animação exige o papel EFEITOS_VISUAIS." }`.

Quando o cadastro de profissionais está indisponível a recomendação **não falha**:
responde com `"parcial": true` e os motivos em `"avisos"`.

### Validações

| Campo                              | Regra                                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `titulo` · `genero` · `produtorId` | obrigatórios                                                                                                                                                                                 |
| `tipoCaptacao`                     | `DOCUMENTARIO`, `FICCAO`, `ANIMACAO` ou `PUBLICITARIO`                                                                                                                                       |
| `detalhes`                         | só os campos do tipo (tabela do corpo **A**); textos até 200 caracteres, listas até 50 itens, no máximo 20 campos                                                                            |
| `duracaoMinutos`                   | inteiro de 1 a 100.000                                                                                                                                                                       |
| `orcamento`                        | maior que zero, até 999.999.999.999 e suficiente para R$ 1.000 por papel                                                                                                                     |
| `dataInicio` · `dataEntrega`       | ISO 8601; entrega depois do início e ainda não vencida                                                                                                                                       |
| `localizacao.uf`                   | 2 letras; latitude e longitude em faixas válidas                                                                                                                                             |
| `requisitos`                       | de 1 a 6 papéis, sem repetir; peso entre 0 (exclusivo) e 10                                                                                                                                  |
| `estrategia`                       | uma das listadas em `GET /estrategias` ou o recomendador do tipo                                                                                                                             |
| `parametros`                       | números de 0 a 1.000.000; `topN` de 1 a 100; `numeroSugestoes` de 1 a 10; `scoreMinimo` até 1; `mediaPriori` de 1 a 5; `limiteOrcamentoReduzido` e `custoMinimoPorPapel` até 999.999.999.999 |
| `reavaliacao`                      | ao menos um campo; `limiar` entre 0 e 1                                                                                                                                                      |
| campos desconhecidos               | recusados com 400 `REQUISICAO_INVALIDA`                                                                                                                                                      |

---

## Arquitetura

Camadas com inversão de dependência. O domínio não conhece Fastify nem TypeORM; a
aplicação depende só de portas (interfaces); a composição é explícita em
`src/container.ts`.

```
src/
  domain/              entidades, value objects, eventos tipados, interface Visitavel
    entidades/projetos/  subclasses de Projeto com clonar() (Prototype)
  application/
    ports/             interfaces que a aplicação exige (repositórios, Sujeito, canais)
    strategies/        Strategy
    orchestration/     Template Method (recebe a FabricaProjeto)
    observers/         Observer
    visitors/          Visitor
    familias/          Abstract Factory e Factory Method: uma pasta por tipo de projeto
    prototipos/        catálogo de modelos clonáveis (Prototype)
    use-cases/         um caso de uso por ação da API
  infrastructure/      TypeORM, cache resiliente, EventEmitter, canais de saída, varredura, pino
  api/                 rotas Fastify, schemas TypeBox, apresentação e erros
  container.ts         composition root
  cluster.ts           vários processos Node atrás da mesma porta
```

A troca do EventEmitter por RabbitMQ é uma nova implementação da porta `Sujeito`,
sem alterar observadores nem casos de uso.

---

## Requisitos atendidos

### ATVI

| Requisito                                                                                        | Onde                                                                    | Teste                                                              |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| RF01 projeto com gênero, duração, orçamento, entrega, captação, local e papéis com peso          | `domain/entidades/projeto.ts`, `api/schemas`                            | `projeto.test.ts`, `rotas.test.ts`                                 |
| RF02 profissional com histórico, avaliações, especialidades, preço, agenda, local e competências | `domain/entidades/profissional.ts`                                      | `profissional.test.ts`, `repositorios.test.ts`                     |
| RF03 ranking por papel respeitando orçamento e prazo                                             | `strategies/ranqueador.ts`, `filtros-candidato.ts`                      | `contrato-estrategias.test.ts`                                     |
| RF04 uma ou mais sugestões de equipe                                                             | `orchestration/orquestrador-padrao.ts`                                  | `orquestrador-padrao.test.ts`                                      |
| RF05 aceitar, rejeitar e substituir membros                                                      | `use-cases/casos-equipe.ts`, `domain/entidades/equipe.ts`               | `equipe.test.ts`, `rotas.test.ts`                                  |
| RF06 substituição refaz só o papel afetado                                                       | `orchestration/orquestrador-substituicao.ts`                            | `orquestrador-substituicao.test.ts`                                |
| RF07 reavaliação completa quando orçamento/prazo mudam muito                                     | `Projeto.solicitarReavaliacao`, `ReavaliarProjeto`                      | `projeto.test.ts`, `rotas.test.ts`                                 |
| RF08 profissionais avisados do interesse do produtor                                             | `observers/compositor-notificacoes.ts`                                  | `observadores.test.ts`                                             |
| RF09 produtor avisado de aceite, recusa e convite expirado                                       | `observers/compositor-notificacoes.ts`                                  | `observadores.test.ts`, `expiracao-convites.test.ts`               |
| RF10 recusa atualiza a composição e gera nova rodada                                             | `observers/atualizador-composicao.ts`                                   | `atualizador-composicao.test.ts`, `robustez.test.ts`               |
| RF11 composição final registrada e publicada para projetos e financeiro                          | `FinalizarEquipe`, `observers/publicador-integracao.ts`                 | `api-fluxo.test.ts`                                                |
| RF12 estratégia dinâmica, na criação ou pelo produtor                                            | `strategies/registro-estrategias.ts`, `sistema-recomendacao.ts`         | `demonstracao-strategy.test.ts`                                    |
| RF13 validação, compatibilidade e relatório                                                      | `application/visitors`                                                  | `demonstracao-visitor.test.ts`, `visitantes.test.ts`               |
| RF14 endpoint que recebe o projeto e devolve a equipe com notificações e auditoria               | `POST /projetos`                                                        | `rotas.test.ts`, `api-fluxo.test.ts`                               |
| RNF01 menos de 2 s com 10 mil profissionais                                                      | cache do cadastro, ranqueador com top-N parcial                         | `estrategias.desempenho.test.ts`, [desempenho](docs/desempenho.md) |
| RNF02 pelo menos 100 requisições simultâneas                                                     | `cluster.ts`, pool repartido                                            | [desempenho](docs/desempenho.md): 100 simultâneas, 0 erros         |
| RNF03 precisão mensurável e algoritmo parametrizável                                             | `strategies/parametros-recomendacao.ts`, `avaliacao/precisao.ts`        | `precisao.test.ts`, `npm run precisao`                             |
| RNF04 ações registradas em logs estruturados                                                     | `observers/auditoria-recomendacao.ts`, tabela `auditoria`, pino em JSON | `observadores.test.ts`, `GET /auditoria`, `robustez.test.ts`       |
| RNF05 tolerância a falhas com resultado parcial                                                  | `repositorio-profissionais-resiliente.ts`, `resiliencia/disjuntor.ts`   | `resiliencia.test.ts`                                              |
| RNF06 camadas, inversão de dependência e injeção explícita                                       | `application/ports`, `container.ts`                                     | `barramento-container.test.ts`                                     |
| RNF07 eventos em memória substituíveis por fila                                                  | porta `Sujeito`, `barramento-eventos-memoria.ts`                        | `demonstracao-observer.test.ts`                                    |
| RNF08 Node LTS, TypeScript estrito, Fastify, PostgreSQL, TypeORM                                 | `package.json`, `tsconfig.json`                                         | CI                                                                 |
| RNF09 testes por padrão e cobertura acima de 80%                                                 | `tests/`                                                                | `npm run coverage` (99,0%)                                         |
| RNF10 Windows 10+ e Ubuntu 24.04+                                                                | scripts sem bash, `.gitattributes`                                      | CI em `ubuntu-24.04` e `windows-latest`                            |

### ATVII

| Tarefa do enunciado                                                                                    | Onde                                                       | Teste                                                                   |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Análise de rigidez, fragilidade e imobilidade do código da ATVI                                        | [docs/analise-critica.md](docs/analise-critica.md)         | —                                                                       |
| 1. Hierarquia de `Projeto` com `clonar()` de cópia profunda (Prototype)                                | `domain/entidades/projeto.ts`, `domain/entidades/projetos` | `demonstracao-prototype.test.ts`, `catalogo-modelos.test.ts`            |
| 2. `FabricaProjeto` e fábricas de documentário, animação e publicidade (Factory Method)                | `application/familias`                                     | `demonstracao-abstract-factory.test.ts`                                 |
| 3. `OrquestradorEquipe` recebe a fábrica no construtor e não tem condicionais por tipo                 | `orchestration/orquestrador-equipe.ts`                     | `demonstracao-abstract-factory.test.ts`, `fabricas-projeto.test.ts`     |
| 4. `SistemaRecomendacao` identifica o tipo e usa a fábrica para criar o ecossistema (Abstract Factory) | `application/sistema-recomendacao.ts`                      | `sistema-recomendacao.test.ts`, `demonstracao-abstract-factory.test.ts` |
| 5. Integração: trocar a fábrica muda recomendação, validação e notificação sem mudar o orquestrador    | `tests/integration/fabricas-projeto.test.ts`               | idem, com PostgreSQL real                                               |
| Recomendador de animação que prioriza software de modelagem 3D                                         | `familias/animacao/recomendador-animacao.ts`               | `demonstracao-abstract-factory.test.ts`                                 |
| Relatório de animação com métricas de renderização                                                     | `familias/animacao/gerador-relatorio-animacao.ts`          | `demonstracao-abstract-factory.test.ts`                                 |
| Windows 10+ e Ubuntu 24.04.3+                                                                          | nada específico de sistema operacional; Docker e Node 22   | CI em `ubuntu-24.04` e `windows-latest`                                 |

## Desempenho

| Cenário (POST /projetos, 6 papéis, 10 mil profissionais) | Resultado                                    |
| -------------------------------------------------------- | -------------------------------------------- |
| Requisição isolada                                       | 0,27 s                                       |
| 100 requisições simultâneas                              | todas abaixo de 2 s (máximo 1,81 s), 0 erros |
| 100 conexões contínuas por 30 s                          | 87 req/s, p99 1,76 s, 0 erros                |
| 100 simultâneas, medido de novo após a ATVII             | p50 0,82–0,89 s, máximo 0,95 s, 0 erros      |

Metodologia, as otimizações medidas e a precisão de cada estratégia estão em
[docs/desempenho.md](docs/desempenho.md).

## Documentos

| Arquivo                                            | Conteúdo                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| [docs/analise-critica.md](docs/analise-critica.md) | rigidez, fragilidade e imobilidade da ATVI e as correções |
| [docs/desempenho.md](docs/desempenho.md)           | medições de desempenho, resiliência e precisão            |

---

<details>
<summary>🎬 Cena pós-créditos</summary>

```text
 ________________________________
|\  /\  /\  /\  /\  /\  /\  /\  /|
| \/  \/  \/  \/  \/  \/  \/  \/ |
|________________________________|
| CINEBRIDGE                     |
| CENA ............ pós-créditos |
| TOMADA ................. ATVII |
| DIREÇÃO .... Equipe CineBridge |
|________________________________|
```

- **Elenco:** 10.000 profissionais gerados pelo seed (nenhum deles sabe que é fictício).
- **Roteiro:** 7 padrões de projeto e nenhum `if` por tipo de projeto no orquestrador.
- **Efeitos especiais:** um projeto de realidade virtual que só existe dentro dos testes.
- **Aviso:** nenhum profissional foi maltratado durante os 390 testes. Alguns foram recusados, mas quase todos ganharam um substituto.
- **Agradecimentos especiais:** Prof. Dr. Eng. Gerson Penha.

Psiu: a Cena 1 passa toda vez que o serviço sobe. Procure por "tomada" em
`docker compose logs recomendacao`.

</details>
