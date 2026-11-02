# Análise de anti-padrões do microsserviço

A ATVIII pede uma análise do código da plataforma em busca de anti-padrões introduzidos sem
intenção, com a refatoração que elimina cada desvio. Um anti-padrão é uma solução que parece boa,
se repete e acaba custando mais do que resolve, e que tem uma refatoração conhecida.

## Como a análise foi feita

Além da leitura do código, as regras abaixo do ESLint rodaram sobre `src/` para apontar as áreas de
risco. Elas não fazem parte do lint do projeto; foram usadas só nesta medição.

| Métrica                  | Limite usado | Pontos acima do limite                                                                                                                                       |
| ------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Complexidade ciclomática | 8            | `dadosDoClone` (16), `comporNotificacoes` (15), `tratarErro` (13), `validarParametros` (12), `ServicoAtomico.validar` (10), `preparar` (10) e outros 3 com 9 |
| Linhas por função        | 60           | `rotasProjetos` (270), `criarContainer` (154), `rotasIntegracoes` (116), `comporNotificacoes` (95), `gerarCadastroComQualidade` (72)                         |
| Parâmetros               | 5            | Construtores privados de entidades, como `Recomendacao` (11), `Convite` (10) e `Profissional` (10)                                                           |
| Profundidade de blocos   | 3            | Nenhum                                                                                                                                                       |
| Profundidade de herança  | —            | Nenhuma classe do projeto passa de dois níveis próprios                                                                                                      |

## Anti-padrões examinados

| Anti-padrão                                  | Situação            | Evidência no código                                                                                                                                                                                         | Refatoração                                                                                                                                                              |
| -------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Blob / Objeto Deus**                       | Risco controlado    | `SistemaRecomendacao` tem 233 linhas e, pelo diagrama, passou a receber armazenamento, pagamento e profissionais. Pagamento e armazenamento não são responsabilidade de um sistema de recomendação.         | Ele só guarda e expõe os adaptadores. As regras ficam em `ArquivosProjeto` e `PagamentosEquipe`, e a pilha de decoradores em `MontadorDecoradores`.                      |
| **Blob**                                     | Corrigido na ATVIII | `Projeto` passaria a validar custo e prazo dos serviços com um método `validarEstrutura`. O teste do Visitor da ATVI recusou o método, porque a entidade não deve validar.                                  | A regra virou o visitante `ValidadorEstrutura`, que também alimenta o relatório do projeto.                                                                              |
| **Herança profunda**                         | Não encontrado      | Todas as hierarquias têm uma base e uma subclasse (`Projeto`, `FabricaProjeto`, `OrquestradorEquipe`, `RecomendadorBase`, `DecoradorRecomendacao`).                                                         | O Decorator evita a hierarquia que surgiria com uma subclasse para cada combinação de cache, auditoria e compressão.                                                     |
| **Spaghetti Code**                           | Risco baixo         | Nenhum bloco passa de 3 níveis. `rotasProjetos` tem 270 linhas, mas é uma lista plana de rotas. `dadosDoClone` chega a 16 de complexidade só por operadores `??` em sequência, sem desvio de fluxo.         | Nenhuma: dividir essas funções esconderia o fluxo sem reduzir acoplamento. `rotasIntegracoes` nasceu separada para não aumentar `rotasProjetos`.                         |
| **Copy-and-Paste**                           | Corrigido na ATVIII | As três estratégias da ATVI repetiam a mesma chamada a `ranquearPorPapel`.                                                                                                                                  | O fluxo comum subiu para `RecomendadorBase`; cada estratégia só informa como avaliar um candidato.                                                                       |
| **Copy-and-Paste**                           | Mantido por decisão | `AdaptadorS3` e `AdaptadorGoogleCloud` são quase iguais, e o mesmo vale para os adaptadores de pagamento.                                                                                                   | Mantidos: o diagrama pede uma classe por provedor, e em uma integração real essas classes vão divergir. O trecho realmente comum foi extraído para `chave-arquivo.ts`.   |
| **Estado global (Singleton disfarçado)**     | Risco documentado   | Há uma instância de `SistemaRecomendacao` por processo. `definirEstrategia` e `configurarAdaptadores` alteram estado visto por todas as requisições. Não há `getInstance` nem instância global em módulo.   | A API não chama esses dois métodos durante as requisições: a estratégia e a pilha vão por parâmetro em cada chamada, e os adaptadores são configurados na inicialização. |
| **Factory Method mal aplicado**              | Não encontrado      | As quatro fábricas têm a mesma interface, `FabricaProjeto`, e criam objetos que compartilham contratos. A hierarquia não cresceu: cada tipo tem uma única fábrica.                                          | Nenhuma. O teste da fábrica de realidade virtual segue garantindo que um tipo novo não altera o orquestrador.                                                            |
| **Decorator como anti-padrão**               | Evitado             | Um decorador que mudasse `nome` quebraria a resolução da estratégia em `SistemaRecomendacao` e gravaria um nome errado no projeto. Um cache sem os candidatos na chave devolveria profissional já recusado. | Os decoradores repassam `nome` e `descricao` do recomendador interno, e a chave do cache inclui projeto, parâmetros e candidatos.                                        |
| **Abstração vazada no Adapter**              | Evitado             | Os ids de perfis externos poderiam misturar-se ao cadastro interno ao serem espelhados no banco para atender à chave estrangeira de `membro_equipe`.                                                        | Os ids levam o prefixo do provedor, e `AdaptadorInterno` ignora os perfis espelhados. Centavos, status e escalas de nota ficam nos adaptadores.                          |
| **Lista simples no lugar de uma hierarquia** | Corrigido na ATVIII | `Projeto` guardava uma lista de papéis, sem como representar um pacote de pós-produção com subpacotes.                                                                                                      | Composite: `servicoPrincipal` passa a ser a fonte dos papéis, do custo e do prazo.                                                                                       |

## Pontos que continuam em aberto

- **`criarContainer` tem 154 linhas.** É um _composition root_ sem regra de negócio, e a ATVIII o
  fez crescer. Se crescer mais, vale separá-lo em funções por área: banco, canais e integrações.
- **`DependenciasCasosDeUso` tem 11 dependências**, e cada caso de uso recebe todas. Isso aproxima
  o objeto de um _Service Locator_. Ainda é aceitável porque a composição é explícita, mas casos de
  uso novos deveriam declarar só o que usam.
- **Os construtores das entidades têm até 11 parâmetros.** São privados e sempre chamados pelo
  `criar` da própria classe, então o risco de trocar argumentos fica contido em um único ponto.

## Como verificar

- `tests/unit/application/visitors/demonstracao-visitor.test.ts`: a entidade não ganha lógica de
  validação.
- `tests/integration/adapter.test.ts`: a lógica de negócio não cita nenhum provedor concreto.
- `tests/integration/decorator.test.ts`: `SistemaRecomendacao` e os recomendadores não conhecem
  nenhum decorador.
- `tests/integration/fabricas-projeto.test.ts`: o orquestrador e o sistema não citam nenhum tipo
  concreto de projeto.
